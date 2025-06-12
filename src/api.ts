import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import amqp from 'amqplib';

const app = express();
const APP_PORT = process.env.PORT || 4000;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// RabbitMQ Connection
let channel = null;

async function connectRabbitMQ() {
    try {
        //Establishes a TCP connection to RabbitMQ
        const connection = await amqp.connect(RABBITMQ_URL);

        //A lightweight abstraction over the connection for performing AMQP operations
        channel = await connection.createChannel();

        // Assert queues and exchanges
        await channel.assertQueue('tasks', { durable: true }); //durable: true > Survives broker restarts.
        //Handles messages that fail processing after retries
        await channel.assertExchange('dlx_exchange', 'direct', { durable: true });
        //dead_letter_queue stores failed messages indefinitely (no durable flag needed as it inherits from the exchange)
        //Messages are routed here after retry attempts are exhausted
        await channel.assertQueue('dead_letter_queue');
        //Links the queue to the exchange with routing key failed.
        await channel.bindQueue('dead_letter_queue', 'dlx_exchange', 'failed');

        console.log('Connected to RabbitMQ');
    } catch (error) {
        console.error('RabbitMQ connection error:', error);
        setTimeout(connectRabbitMQ, 5000); // Reconnect after 5 seconds
    }
}

// Health Check
app.get('/check', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        rabbitmq: channel ? 'connected' : 'disconnected'
    });
});

// Message Producer Endpoint
app.post('/messages', async (req, res) => {
    if (!channel) {
        return res.status(503).json({ error: 'RabbitMQ not connected' });
    }

    const { message } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        await channel.sendToQueue(
            'tasks',
            Buffer.from(JSON.stringify({
                content: message,
                timestamp: new Date().toISOString()
            })),
            {
                persistent: true,
                headers: {
                    'x-retry-count': 0 // For dead letter handling
                }
            }
        );

        res.json({ status: 'Message queued successfully' });
    } catch (error) {
        console.error('Publishing error:', error);
        res.status(500).json({ error: 'Failed to queue message' });
    }
});

// Start Consumer
async function startConsumer() {
    if (!channel) return;

    try {
        await channel.consume('tasks', async (msg) => {
            if (msg) {
                try {
                    const content = JSON.parse(msg.content.toString());
                    console.log('Processing message:', content);

                    // Simulate processing
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // Acknowledge message
                    channel.ack(msg);
                    console.log('Message processed successfully');
                } catch (error) {
                    console.error('Processing failed:', error);

                    // Dead letter handling
                    if (msg.properties.headers['x-retry-count'] < 3) {
                        const retryCount = msg.properties.headers['x-retry-count'] + 1;
                        channel.sendToQueue(
                            'tasks',
                            msg.content,
                            {
                                persistent: true,
                                headers: { 'x-retry-count': retryCount }
                            }
                        );
                    } else {
                        channel.sendToExchange(
                            'dlx_exchange',
                            'failed',
                            msg.content
                        );
                    }
                    channel.ack(msg); // Remove from original queue
                }
            }
        });

        console.log('Consumer started');
    } catch (error) {
        console.error('Consumer error:', error);
    }
}

// Initialize
async function initialize() {
    await connectRabbitMQ();
    await startConsumer();

    app.listen(APP_PORT, () => {
        console.log(`Server running on port ${APP_PORT}`);
        console.log(`RabbitMQ connected: ${channel !== null}`);
    });
}

initialize().catch(console.error);

// Cleanup on exit
process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    if (channel) {
        await channel.close();
    }
    process.exit(0);
});