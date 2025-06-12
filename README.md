# RabbitMQ Example

A Node.js service that demonstrates RabbitMQ integration with REST API endpoints for message processing, including dead letter queue handling and retry mechanisms.

## Prerequisites

Before you begin, ensure you have the following installed:

- [Docker](https://docs.docker.com/compose/install/)
- Yarn v1.22.17 or higher
- Node.js v14.17.0 or higher

## Architecture Overview

This application implements a robust message processing system with the following components:

### Core Components

#### **1. Main Task Queue (`tasks`)**
- **Purpose**: Primary queue for processing messages
- **Configuration**: `durable: true` - survives broker restarts
- **Flow**: Receives messages → processes them → acknowledges completion

#### **2. Dead Letter Exchange (`dlx_exchange`)**
- **Type**: Direct exchange
- **Purpose**: Routes messages that fail processing after retry attempts
- **Routing**: Uses routing key `'failed'` to direct messages to dead letter queue

#### **3. Dead Letter Queue (`dead_letter_queue`)**
- **Purpose**: Stores permanently failed messages for manual inspection
- **Binding**: Connected to `dlx_exchange` with routing key `'failed'`
- **Use Case**: Manual analysis of problematic messages

### Message Flow

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Client    │───▶│  tasks queue │───▶│   Processing    │
└─────────────┘    └──────────────┘    └─────────────────┘
                                                │
                                                ▼
                           ┌─────────────────────────────────┐
                           │         Success?                │
                           └─────────────────────────────────┘
                                      │              │
                                     Yes            No
                                      │              │
                                      ▼              ▼
                              ┌─────────────┐  ┌──────────────┐
                              │ Acknowledge │  │ Retry Count  │
                              │   Message   │  │    < 3?      │
                              └─────────────┘  └──────────────┘
                                                      │
                                                 Yes  │  No
                                              ┌───────┴───────┐
                                              ▼               ▼
                                      ┌─────────────┐  ┌──────────────┐
                                      │   Requeue   │  │ Send to DLX  │
                                      │with retry+1 │  │   Exchange   │
                                      └─────────────┘  └──────────────┘
                                                              │
                                                              ▼
                                                      ┌──────────────┐
                                                      │ Dead Letter  │
                                                      │    Queue     │
                                                      └──────────────┘
```

### Retry Logic

The application implements a 3-retry mechanism:
1. **Initial Processing**: Message attempts processing
2. **Retry 1-3**: If processing fails, message is requeued with incremented retry count
3. **Dead Letter**: After 3 failed attempts, message is sent to dead letter queue

## Standalone RabbitMQ Instance

### 1. Start RabbitMQ Using Docker

To start a RabbitMQ instance, run the following command:

```bash
yarn run start-docker
```

This will start RabbitMQ with:
- **AMQP Port**: 5672
- **Management UI**: http://localhost:15672
- **Default Credentials**: admin/admin

### 2. Start the Example Application

To start the example application using the standalone RabbitMQ instance, run:

```bash
yarn run start
```

The application will:
- Connect to RabbitMQ at `amqp://admin:admin@localhost`
- Create necessary queues and exchanges
- Start the message consumer
- Launch the REST API on port 4000

### 3. Test the Application

#### Send a Message
```bash
curl -X POST http://localhost:4000/messages \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello RabbitMQ!"}'
```

#### Check Application Health
```bash
curl http://localhost:4000/check
```

Expected response:
```json
{
  "status": "healthy",
  "rabbitmq": "connected"
}
```

## API Endpoints

### POST `/messages`
Sends a message to the task queue for processing.

**Request Body:**
```json
{
  "message": "Your message content here"
}
```

**Response:**
```json
{
  "status": "Message queued successfully"
}
```

### GET `/check`
Returns the health status of the application and RabbitMQ connection.

**Response:**
```json
{
  "status": "healthy",
  "rabbitmq": "connected"
}
```

## Message Processing

### Normal Processing
1. Message is received in the `tasks` queue
2. Consumer processes the message (simulates 1-second processing time)
3. Message is acknowledged and removed from queue
4. Success logged to console

### Error Handling
1. If processing fails, retry count is checked
2. If retry count < 3: Message is requeued with incremented retry count
3. If retry count ≥ 3: Message is sent to dead letter exchange
4. Dead letter exchange routes message to `dead_letter_queue`

### Dead Letter Message Inspection

You can inspect failed messages using the RabbitMQ Management UI:

1. Open http://localhost:15672
2. Login with admin/admin
3. Navigate to **Queues** tab
4. Click on `dead_letter_queue`
5. View message details and content

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | Application server port |
| `RABBITMQ_URL` | `amqp://admin:admin@localhost` | RabbitMQ connection string |

## Key Features

- **Durable Queues**: Messages survive broker restarts
- **Retry Mechanism**: Failed messages are retried up to 3 times
- **Dead Letter Handling**: Permanently failed messages are preserved for analysis
- **Health Monitoring**: Built-in health check endpoint
- **Graceful Shutdown**: Proper cleanup on application termination
- **Connection Recovery**: Automatic reconnection on connection loss

## Troubleshooting

### Connection Issues
- Ensure RabbitMQ is running: `docker ps`
- Check RabbitMQ logs: `docker logs <container_id>`
- Verify connection URL and credentials

### Message Processing Issues
- Check application logs for processing errors
- Inspect dead letter queue for failed messages
- Monitor retry counts in message headers

### Performance Monitoring
- Use RabbitMQ Management UI to monitor queue lengths
- Check message rates and processing times
- Monitor memory and disk usage

## Production Considerations

- Configure appropriate queue and exchange durability settings
- Implement proper logging and monitoring
- Set up RabbitMQ clustering for high availability
- Configure resource limits and policies
- Implement message persistence strategies
- Set up alerting for dead letter queue accumulation

## More Question:

See documentation [here](question.md)