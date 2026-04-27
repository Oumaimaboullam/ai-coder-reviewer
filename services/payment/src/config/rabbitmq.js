/**
 * Configuration RabbitMQ pour le service de paiement
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
        
        // Déclaration des exchanges
        await this.channel.assertExchange('payment-events', 'fanout', { durable: true });
        await this.channel.assertExchange('app-events', 'direct', { durable: true });
        
        console.log('[INFO] RabbitMQ connecté pour le service Payment');
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

  async close() {
    if (this.connection) {
      await this.connection.close();
    }
  }
}

module.exports = new RabbitMQClient();
