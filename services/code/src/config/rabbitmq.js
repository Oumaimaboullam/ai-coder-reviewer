/**
 * Configuration RabbitMQ pour le service de code
 */
const amqp = require('amqplib');

class RabbitMQClient {
  constructor() {
    this.connection = null;
    this.channel = null;
  }

  async connect(retries = 10) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log('[INFO] Connexion à RabbitMQ (tentative ${attempt}/${retries})...');
        this.connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672');
        this.channel = await this.connection.createChannel();
        
        // Configuration Dead Letter Exchange
        await this.channel.assertExchange('dlx', 'direct', { durable: true });
        await this.channel.assertQueue('code-service-dlq', { durable: true });
        await this.channel.bindQueue('code-service-dlq', 'dlx', 'code-service-dlq');

        // Déclaration des exchanges principaux
        await this.channel.assertExchange('code-events', 'fanout', { durable: true });
        await this.channel.assertExchange('app-events', 'direct', { durable: true });
        
        // Déclaration des queues pour consommation avec DLX
        await this.channel.assertQueue('code-service-queue', { 
          durable: true,
          arguments: {
            'x-dead-letter-exchange': 'dlx',
            'x-dead-letter-routing-key': 'code-service-dlq'
          }
        });
        await this.channel.bindQueue('code-service-queue', 'app-events', 'analysis.completed');
        await this.channel.bindQueue('code-service-queue', 'app-events', 'analysis.failed');
        
        console.log('[INFO] RabbitMQ connecté pour le service Code');
        return this.channel;
      } catch (error) {
        console.error('[ERROR] RabbitMQ indisponible (tentative ${attempt}/${retries}):', error.message);
        if (attempt < retries) {
          await new Promise(res => setTimeout(res, 5000));
        }
      }
    }
    console.error('[ERROR] Impossible de se connecter à RabbitMQ après toutes les tentatives');
    return null;
  }

  async publishEvent(exchange, routingKey, data) {
    if (!this.channel) {
      console.warn('️ RabbitMQ non connecté, événement non publié');
      return false;
    }

    try {
      const message = Buffer.from(JSON.stringify(data));
      this.channel.publish(exchange, routingKey, message, { persistent: true });
      console.log('[INFO] Événement publié sur ${exchange}:${routingKey}');
      return true;
    } catch (error) {
      console.error('[ERROR] Erreur publication événement:', error.message);
      return false;
    }
  }

  async consume(queue, callback) {
    if (!this.channel) {
      console.warn('️ RabbitMQ non connecté, impossible de consommer');
      return;
    }

    try {
      await this.channel.consume(queue, async (msg) => {
        if (msg) {
          try {
            const content = JSON.parse(msg.content.toString());
            await callback(content);
            this.channel.ack(msg);
          } catch (error) {
            console.error('[ERROR] Erreur traitement message:', error.message);
            this.channel.nack(msg, false, false); // Rejeter le message sans requeue
          }
        }
      });
      console.log('[INFO] Consommation démarrée sur la queue: ${queue}');
    } catch (error) {
      console.error('[ERROR] Erreur consommation:', error.message);
    }
  }

  async close() {
    if (this.connection) {
      await this.connection.close();
    }
  }
}

module.exports = new RabbitMQClient();
