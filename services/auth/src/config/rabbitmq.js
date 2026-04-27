const amqp = require('amqplib');

class RabbitMQClient {
  constructor() {
    this.connection = null;
    this.channel = null;
  }

  async connect() {
    while (true) {
      try {
        console.log('[INFO] Connexion à RabbitMQ...');
        
        this.connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672');
        this.channel = await this.connection.createChannel();

        // Configuration Dead Letter Exchange
        await this.channel.assertExchange('dlx', 'direct', { durable: true });
        await this.channel.assertQueue('auth-service-dlq', { durable: true });
        await this.channel.bindQueue('auth-service-dlq', 'dlx', 'auth-service-dlq');

        await this.channel.assertExchange('auth-events', 'fanout', { durable: true });
        await this.channel.assertExchange('app-events', 'direct', { durable: true });
        await this.channel.assertExchange('payment-events', 'fanout', { durable: true });

        // Queue pour recevoir les événements de paiement (abonnements) avec DLX
        await this.channel.assertQueue('auth-payment-events', { 
          durable: true,
          arguments: {
            'x-dead-letter-exchange': 'dlx',
            'x-dead-letter-routing-key': 'auth-service-dlq'
          }
        });
        await this.channel.bindQueue('auth-payment-events', 'payment-events', '');

        console.log('[INFO] RabbitMQ connecté !');
        break;

      } catch (error) {
        console.error('[ERROR] RabbitMQ indisponible, retry dans 5s...');
        await new Promise(res => setTimeout(res, 5000));
      }
    }
  }

  async publishEvent(exchange, routingKey, data) {
    try {
      if (!this.channel) {
        console.warn("️ Channel RabbitMQ non prêt");
        return false;
      }

      const message = Buffer.from(JSON.stringify(data));
      this.channel.publish(exchange, routingKey, message, { persistent: true });

      console.log('[INFO] Event: ${exchange}:${routingKey}');
      return true;

    } catch (error) {
      console.error('[ERROR] Erreur publish:', error.message);
      return false;
    }
  }

  async close() {
    if (this.connection) {
      await this.connection.close();
    }
  }

  async consume(queue, callback) {
    if (!this.channel) {
      console.warn('️ Channel RabbitMQ non prêt pour consumer');
      return;
    }

    try {
      await this.channel.consume(queue, async (msg) => {
        if (msg) {
          try {
            const data = JSON.parse(msg.content.toString());
            await callback(data);
            this.channel.ack(msg);
          } catch (error) {
            console.error('[ERROR] Erreur traitement message [${queue}]:', error.message);
            this.channel.nack(msg, false, false);
          }
        }
      });

      console.log('[INFO] Consumer ${queue} démarré');
    } catch (error) {
      console.error('[ERROR] Erreur setup consumer ${queue}:', error.message);
    }
  }

  async setupConsumer(queueName, exchange, routingKey = '') {
    if (!this.channel) {
      console.warn('️ Channel RabbitMQ non prêt pour consumer');
      return;
    }

    try {
      await this.channel.assertQueue(queueName, { durable: true });
      
      if (routingKey) {
        await this.channel.bindQueue(queueName, exchange, routingKey);
      }

      await this.channel.consume(queueName, (msg) => {
        if (msg) {
          const data = JSON.parse(msg.content.toString());
          console.log(` Event reçu [${queueName}]:`, data);
          this.channel.ack(msg);
        }
      });

      console.log('[INFO] Consumer ${queueName} démarré');
    } catch (error) {
      console.error('[ERROR] Erreur setup consumer ${queueName}:', error.message);
    }
  }
}

module.exports = new RabbitMQClient();