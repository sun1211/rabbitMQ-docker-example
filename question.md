# RabbitMQ Core Components: Exchanges, Queues, and Bindings

A comprehensive guide to understanding and implementing RabbitMQ's core messaging architecture with practical Node.js examples.

## Table of Contents
- [Overview](#overview)
- [Core Components](#core-components)
- [Installation](#installation)
- [Complete Demo](#complete-demo)
- [Practical Examples](#practical-examples)
- [Best Practices](#best-practices)

## Overview

RabbitMQ is a powerful message broker implementing the Advanced Message Queuing Protocol (AMQP). Its architecture revolves around three fundamental components that work together to route messages efficiently:

- **Exchanges**: Message routing agents
- **Queues**: Message storage buffers  
- **Bindings**: Routing rules connecting exchanges to queues

Think of it like a postal system where exchanges are sorting facilities, queues are mailboxes, and bindings are the address rules that determine where mail goes.

## Core Components

### 1. Exchanges
Exchanges receive messages from producers and route them to queues based on specific rules.

**Types:**
- **Direct**: Routes based on exact routing key match
- **Fanout**: Broadcasts to all bound queues
- **Topic**: Routes using pattern matching with wildcards
- **Headers**: Routes based on message headers

### 2. Queues
Queues store messages until consumers process them.

**Characteristics:**
- FIFO message ordering (by default)
- Multiple consumers can subscribe (competing consumers)
- Can be durable (survive broker restart) or transient
- Support TTL, max length, dead letter exchanges

### 3. Bindings
Bindings define the relationship between exchanges and queues.

**Key aspects:**
- Connect exchanges to queues with routing rules
- Include routing keys or matching criteria
- Multiple bindings possible between same exchange/queue

## Installation

```bash
# Install RabbitMQ server (Ubuntu/Debian)
sudo apt-get install rabbitmq-server

# Install Node.js client library
npm install amqplib

# Start RabbitMQ server
sudo systemctl start rabbitmq-server
```

## Complete Demo

Here's a comprehensive demonstration showing all exchange types and their routing behavior:

```javascript
const amqp = require('amqplib');

class RabbitMQDemo {
  constructor() {
    this.connection = null;
    this.channel = null;
  }

  async connect() {
    try {
      this.connection = await amqp.connect('amqp://localhost');
      this.channel = await this.connection.createChannel();
      console.log('✅ Connected to RabbitMQ');
    } catch (error) {
      console.error('❌ Connection failed:', error.message);
      throw error;
    }
  }

  async setupExchanges() {
    // Declare different exchange types
    await this.channel.assertExchange('direct_exchange', 'direct', { durable: false });
    await this.channel.assertExchange('fanout_exchange', 'fanout', { durable: false });
    await this.channel.assertExchange('topic_exchange', 'topic', { durable: false });
    
    console.log('📡 Exchanges created: direct, fanout, topic');
  }

  async setupQueues() {
    // Direct exchange queues
    await this.channel.assertQueue('orders_priority', { durable: false });
    await this.channel.assertQueue('orders_standard', { durable: false });
    
    // Fanout exchange queues
    await this.channel.assertQueue('notifications_email', { durable: false });
    await this.channel.assertQueue('notifications_sms', { durable: false });
    
    // Topic exchange queues
    await this.channel.assertQueue('logs_error', { durable: false });
    await this.channel.assertQueue('logs_info', { durable: false });
    await this.channel.assertQueue('logs_all', { durable: false });
    
    console.log('📦 Queues created');
  }

  async setupBindings() {
    // Direct exchange bindings - exact match
    await this.channel.bindQueue('orders_priority', 'direct_exchange', 'priority');
    await this.channel.bindQueue('orders_standard', 'direct_exchange', 'standard');
    
    // Fanout exchange bindings - no routing key needed
    await this.channel.bindQueue('notifications_email', 'fanout_exchange', '');
    await this.channel.bindQueue('notifications_sms', 'fanout_exchange', '');
    
    // Topic exchange bindings - pattern matching
    await this.channel.bindQueue('logs_error', 'topic_exchange', '*.error.*');
    await this.channel.bindQueue('logs_info', 'topic_exchange', '*.info.*');
    await this.channel.bindQueue('logs_all', 'topic_exchange', 'application.#');
    
    console.log('🔗 Bindings established');
  }

  async setupConsumers() {
    // Direct exchange consumers
    await this.channel.consume('orders_priority', (msg) => {
      console.log(`🚀 [PRIORITY ORDER] ${msg.content.toString()}`);
      this.channel.ack(msg);
    });
    
    await this.channel.consume('orders_standard', (msg) => {
      console.log(`📋 [STANDARD ORDER] ${msg.content.toString()}`);
      this.channel.ack(msg);
    });

    // Fanout exchange consumers
    await this.channel.consume('notifications_email', (msg) => {
      console.log(`📧 [EMAIL] ${msg.content.toString()}`);
      this.channel.ack(msg);
    });
    
    await this.channel.consume('notifications_sms', (msg) => {
      console.log(`📱 [SMS] ${msg.content.toString()}`);
      this.channel.ack(msg);
    });

    // Topic exchange consumers
    await this.channel.consume('logs_error', (msg) => {
      console.log(`❌ [ERROR LOG] ${msg.content.toString()} (Key: ${msg.fields.routingKey})`);
      this.channel.ack(msg);
    });
    
    await this.channel.consume('logs_info', (msg) => {
      console.log(`ℹ️  [INFO LOG] ${msg.content.toString()} (Key: ${msg.fields.routingKey})`);
      this.channel.ack(msg);
    });
    
    await this.channel.consume('logs_all', (msg) => {
      console.log(`📝 [ALL LOGS] ${msg.content.toString()} (Key: ${msg.fields.routingKey})`);
      this.channel.ack(msg);
    });
    
    console.log('👂 Consumers ready');
  }

  async publishMessages() {
    console.log('\n🚀 Publishing messages...\n');
    
    // Direct exchange - exact routing key match
    await this.channel.publish('direct_exchange', 'priority', 
      Buffer.from('Rush order for premium customer'));
    await this.channel.publish('direct_exchange', 'standard', 
      Buffer.from('Regular order processing'));
    
    // Fanout exchange - broadcasts to all queues
    await this.channel.publish('fanout_exchange', '', 
      Buffer.from('System maintenance scheduled for tonight'));
    
    // Topic exchange - pattern matching
    await this.channel.publish('topic_exchange', 'application.error.database', 
      Buffer.from('Database connection failed'));
    await this.channel.publish('topic_exchange', 'application.info.startup', 
      Buffer.from('Application started successfully'));
    await this.channel.publish('topic_exchange', 'application.debug.performance', 
      Buffer.from('Response time: 150ms'));
    
    console.log('✉️  Messages published');
  }

  async runDemo() {
    try {
      await this.connect();
      await this.setupExchanges();
      await this.setupQueues();
      await this.setupBindings();
      await this.setupConsumers();
      
      // Wait for consumers to be ready
      setTimeout(async () => {
        await this.publishMessages();
      }, 1000);
      
      // Close after demo
      setTimeout(() => {
        this.connection.close();
        console.log('\n👋 Demo completed');
        process.exit(0);
      }, 3000);
      
    } catch (error) {
      console.error('Demo failed:', error);
    }
  }
}

// Run the demo
const demo = new RabbitMQDemo();
demo.runDemo();
```

## Practical Examples

### E-commerce Notification System

```javascript
const amqp = require('amqplib');

async function setupEcommerceSystem() {
  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();

  // Setup topic exchange for flexible routing
  await channel.assertExchange('ecommerce', 'topic', { durable: true });

  // Create specialized queues
  const queues = [
    'customer_emails',      // Customer email notifications
    'admin_alerts',         // Critical admin alerts  
    'inventory_updates',    // Inventory management
    'analytics_events'      // Analytics and reporting
  ];

  for (const queue of queues) {
    await channel.assertQueue(queue, { durable: true });
  }

  // Setup bindings with specific routing patterns
  await channel.bindQueue('customer_emails', 'ecommerce', 'customer.email.#');
  await channel.bindQueue('admin_alerts', 'ecommerce', 'admin.alert.#');
  await channel.bindQueue('inventory_updates', 'ecommerce', 'inventory.#');
  await channel.bindQueue('analytics_events', 'ecommerce', '*.event.#');

  // Consumers
  await channel.consume('customer_emails', async (msg) => {
    const data = JSON.parse(msg.content.toString());
    console.log(`📧 Sending email to ${data.email}: ${data.subject}`);
    // Email sending logic here
    channel.ack(msg);
  });

  await channel.consume('admin_alerts', async (msg) => {
    const alert = JSON.parse(msg.content.toString());
    console.log(`🚨 ADMIN ALERT: ${alert.message} (Level: ${alert.level})`);
    // Alert handling logic here
    channel.ack(msg);
  });

  // Simulate events
  setTimeout(async () => {
    // Customer order confirmation
    await channel.publish('ecommerce', 'customer.email.order_confirmation', 
      Buffer.from(JSON.stringify({
        email: 'customer@example.com',
        subject: 'Order Confirmation #12345',
        orderId: '12345'
      })));

    // Low inventory alert
    await channel.publish('ecommerce', 'admin.alert.inventory_low', 
      Buffer.from(JSON.stringify({
        message: 'Product XYZ inventory below threshold',
        level: 'warning',
        productId: 'XYZ123'
      })));

    // Analytics event
    await channel.publish('ecommerce', 'customer.event.purchase', 
      Buffer.from(JSON.stringify({
        customerId: 'cust123',
        amount: 99.99,
        timestamp: new Date().toISOString()
      })));

    console.log('E-commerce events published');
  }, 1000);
}

setupEcommerceSystem().catch(console.error);
```

### Microservices Communication

```javascript
async function setupMicroservicesMessaging() {
  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();

  // Headers exchange for complex routing
  await channel.assertExchange('microservices', 'headers', { durable: true });

  // Service-specific queues
  await channel.assertQueue('user_service', { durable: true });
  await channel.assertQueue('payment_service', { durable: true });
  await channel.assertQueue('notification_service', { durable: true });

  // Headers-based bindings
  await channel.bindQueue('user_service', 'microservices', '', {
    'x-match': 'all',
    'service': 'user',
    'action': 'create'
  });

  await channel.bindQueue('payment_service', 'microservices', '', {
    'x-match': 'any',
    'service': 'payment',
    'priority': 'high'
  });

  // Publishing with headers
  const headers = {
    service: 'user',
    action: 'create',
    version: '1.0'
  };

  await channel.publish('microservices', '', 
    Buffer.from(JSON.stringify({ userId: 123, name: 'John Doe' })),
    { headers }
  );
}
```

## Best Practices

### 1. Connection Management
```javascript
class RabbitMQManager {
  constructor() {
    this.connection = null;
    this.channel = null;
  }

  async connect(retries = 5) {
    for (let i = 0; i < retries; i++) {
      try {
        this.connection = await amqp.connect('amqp://localhost');
        this.channel = await this.connection.createChannel();
        
        // Handle connection errors
        this.connection.on('error', (err) => {
          console.error('Connection error:', err);
        });
        
        this.connection.on('close', () => {
          console.log('Connection closed');
        });
        
        return;
      } catch (error) {
        console.log(`Connection attempt ${i + 1} failed, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    throw new Error('Failed to connect after retries');
  }
}
```

### 2. Error Handling and Dead Letter Queues
```javascript
async function setupWithDLQ() {
  const channel = await connection.createChannel();
  
  // Dead letter exchange
  await channel.assertExchange('dlx', 'direct');
  await channel.assertQueue('failed_messages');
  await channel.bindQueue('failed_messages', 'dlx', 'failed');
  
  // Main queue with DLQ configuration
  await channel.assertQueue('main_queue', {
    arguments: {
      'x-dead-letter-exchange': 'dlx',
      'x-dead-letter-routing-key': 'failed',
      'x-message-ttl': 60000  // 60 seconds TTL
    }
  });
}
```

### 3. Message Acknowledgments
```javascript
await channel.consume('my_queue', (msg) => {
  try {
    // Process message
    const data = JSON.parse(msg.content.toString());
    processData(data);
    
    // Acknowledge successful processing
    channel.ack(msg);
  } catch (error) {
    console.error('Processing failed:', error);
    
    // Negative acknowledgment - requeue or send to DLQ
    channel.nack(msg, false, false);
  }
});
```

## Running the Examples

1. Start RabbitMQ server:
   ```bash
   sudo systemctl start rabbitmq-server
   ```

2. Install dependencies:
   ```bash
   npm install amqplib
   ```

3. Run the demo:
   ```bash
   node rabbitmq-demo.js
   ```

4. Monitor with RabbitMQ Management UI:
   ```bash
   # Enable management plugin
   sudo rabbitmq-plugins enable rabbitmq_management
   
   # Access at http://localhost:15672
   # Default credentials: guest/guest
   ```

## Expected Output

When running the complete demo, you should see:
```
✅ Connected to RabbitMQ
📡 Exchanges created: direct, fanout, topic
📦 Queues created
🔗 Bindings established
👂 Consumers ready

🚀 Publishing messages...

🚀 [PRIORITY ORDER] Rush order for premium customer
📋 [STANDARD ORDER] Regular order processing
📧 [EMAIL] System maintenance scheduled for tonight
📱 [SMS] System maintenance scheduled for tonight
❌ [ERROR LOG] Database connection failed (Key: application.error.database)
📝 [ALL LOGS] Database connection failed (Key: application.error.database)
ℹ️  [INFO LOG] Application started successfully (Key: application.info.startup)
📝 [ALL LOGS] Application started successfully (Key: application.info.startup)
📝 [ALL LOGS] Response time: 150ms (Key: application.debug.performance)
✉️  Messages published

👋 Demo completed
```

This demonstrates how RabbitMQ's core components work together to create flexible, scalable messaging patterns for modern applications.

# RabbitMQ Exchange Types: Complete Comparison

A detailed comparison of Direct, Fanout, Topic, and Headers exchanges with practical examples and use cases.

## Quick Reference Table

| Exchange Type | Routing Method | Routing Key | Performance | Use Case |
|---------------|----------------|-------------|-------------|----------|
| **Direct** | Exact match | Required | Fastest | Simple routing, task distribution |
| **Fanout** | Broadcast all | Ignored | Fast | Notifications, real-time updates |
| **Topic** | Pattern matching | Required | Moderate | Flexible routing, logging systems |
| **Headers** | Header attributes | Optional | Slowest | Complex routing, metadata-based |

## 1. Direct Exchange

### How It Works
Routes messages to queues where the **routing key exactly matches** the binding key.

### Characteristics
- ✅ **Fastest** routing performance
- ✅ Simple and predictable
- ✅ Perfect for load balancing
- ❌ Limited flexibility

### Example Scenario
**Order Processing System** - Route orders to specific processing queues

```javascript
const amqp = require('amqplib');

async function directExchangeDemo() {
  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();

  // Create direct exchange
  await channel.assertExchange('order_processing', 'direct', { durable: true });

  // Create queues for different order types
  await channel.assertQueue('express_orders', { durable: true });
  await channel.assertQueue('standard_orders', { durable: true });
  await channel.assertQueue('bulk_orders', { durable: true });

  // Bind queues with exact routing keys
  await channel.bindQueue('express_orders', 'order_processing', 'express');
  await channel.bindQueue('standard_orders', 'order_processing', 'standard');
  await channel.bindQueue('bulk_orders', 'order_processing', 'bulk');

  // Consumers
  await channel.consume('express_orders', (msg) => {
    const order = JSON.parse(msg.content.toString());
    console.log(`🚀 EXPRESS: Processing order ${order.id} - Priority handling`);
    channel.ack(msg);
  });

  await channel.consume('standard_orders', (msg) => {
    const order = JSON.parse(msg.content.toString());
    console.log(`📦 STANDARD: Processing order ${order.id} - Normal handling`);
    channel.ack(msg);
  });

  await channel.consume('bulk_orders', (msg) => {
    const order = JSON.parse(msg.content.toString());
    console.log(`📚 BULK: Processing order ${order.id} - Batch handling`);
    channel.ack(msg);
  });

  // Publish messages with exact routing keys
  await channel.publish('order_processing', 'express', 
    Buffer.from(JSON.stringify({ id: 'ORD-001', customer: 'VIP Customer' })));
  
  await channel.publish('order_processing', 'standard', 
    Buffer.from(JSON.stringify({ id: 'ORD-002', customer: 'Regular Customer' })));
  
  await channel.publish('order_processing', 'bulk', 
    Buffer.from(JSON.stringify({ id: 'ORD-003', customer: 'Wholesale Customer' })));

  // This message won't be routed anywhere (no queue bound to 'unknown')
  await channel.publish('order_processing', 'unknown', 
    Buffer.from(JSON.stringify({ id: 'ORD-004', customer: 'Lost Customer' })));

  console.log('Direct exchange messages published');
}
```

### Best Use Cases
- Task distribution among workers
- Load balancing
- Simple routing decisions
- Microservice communication

---

## 2. Fanout Exchange

### How It Works
**Broadcasts messages to ALL bound queues**, ignoring routing keys completely.

### Characteristics
- ✅ **Fast** broadcasting
- ✅ Simple setup
- ✅ Perfect for notifications
- ❌ No selective routing
- ❌ Can overwhelm consumers

### Example Scenario
**System-wide Notifications** - Broadcast updates to all services

```javascript
async function fanoutExchangeDemo() {
  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();

  // Create fanout exchange
  await channel.assertExchange('system_broadcast', 'fanout', { durable: true });

  // Create queues for different services
  await channel.assertQueue('email_service', { durable: true });
  await channel.assertQueue('sms_service', { durable: true });
  await channel.assertQueue('push_notification_service', { durable: true });
  await channel.assertQueue('audit_log_service', { durable: true });

  // Bind ALL queues to fanout exchange (routing key is ignored)
  await channel.bindQueue('email_service', 'system_broadcast', '');
  await channel.bindQueue('sms_service', 'system_broadcast', '');
  await channel.bindQueue('push_notification_service', 'system_broadcast', '');
  await channel.bindQueue('audit_log_service', 'system_broadcast', '');

  // Consumers - all will receive the same message
  await channel.consume('email_service', (msg) => {
    const notification = JSON.parse(msg.content.toString());
    console.log(`📧 EMAIL: Sending email about ${notification.event}`);
    channel.ack(msg);
  });

  await channel.consume('sms_service', (msg) => {
    const notification = JSON.parse(msg.content.toString());
    console.log(`📱 SMS: Sending SMS about ${notification.event}`);
    channel.ack(msg);
  });

  await channel.consume('push_notification_service', (msg) => {
    const notification = JSON.parse(msg.content.toString());
    console.log(`🔔 PUSH: Sending push notification about ${notification.event}`);
    channel.ack(msg);
  });

  await channel.consume('audit_log_service', (msg) => {
    const notification = JSON.parse(msg.content.toString());
    console.log(`📝 AUDIT: Logging event ${notification.event}`);
    channel.ack(msg);
  });

  // Publish to fanout - routing key is ignored
  await channel.publish('system_broadcast', 'any_key_ignored', 
    Buffer.from(JSON.stringify({
      event: 'SYSTEM_MAINTENANCE',
      message: 'System maintenance scheduled for tonight at 2 AM',
      timestamp: new Date().toISOString()
    })));

  await channel.publish('system_broadcast', '', 
    Buffer.from(JSON.stringify({
      event: 'SECURITY_ALERT',
      message: 'Unusual login activity detected',
      timestamp: new Date().toISOString()
    })));

  console.log('Fanout exchange messages published');
}
```

### Best Use Cases
- System-wide announcements
- Real-time updates to multiple services
- Cache invalidation
- Event broadcasting

---

## 3. Topic Exchange

### How It Works
Routes messages based on **pattern matching** between routing key and binding patterns using wildcards:
- `*` (asterisk) = exactly one word
- `#` (hash) = zero or more words

### Characteristics
- ✅ **Most flexible** routing
- ✅ Supports complex patterns
- ✅ Great for hierarchical data
- ❌ Slower than direct/fanout
- ❌ Can be complex to debug

### Example Scenario
**Multi-region Logging System** - Route logs based on source, level, and region

```javascript
async function topicExchangeDemo() {
  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();

  // Create topic exchange
  await channel.assertExchange('application_logs', 'topic', { durable: true });

  // Create specialized queues
  await channel.assertQueue('critical_alerts', { durable: true });
  await channel.assertQueue('europe_logs', { durable: true });
  await channel.assertQueue('database_logs', { durable: true });
  await channel.assertQueue('all_application_logs', { durable: true });

  // Complex topic bindings with wildcards
  await channel.bindQueue('critical_alerts', 'application_logs', '*.critical.*');
  await channel.bindQueue('europe_logs', 'application_logs', 'europe.*.*');
  await channel.bindQueue('database_logs', 'application_logs', '*.*.database');
  await channel.bindQueue('all_application_logs', 'application_logs', 'application.#');

  // Consumers
  await channel.consume('critical_alerts', (msg) => {
    const log = JSON.parse(msg.content.toString());
    console.log(`🚨 CRITICAL ALERT: ${log.message} (${msg.fields.routingKey})`);
    // Send to incident management system
    channel.ack(msg);
  });

  await channel.consume('europe_logs', (msg) => {
    const log = JSON.parse(msg.content.toString());
    console.log(`🇪🇺 EUROPE: ${log.message} (${msg.fields.routingKey})`);
    // Store in European data center
    channel.ack(msg);
  });

  await channel.consume('database_logs', (msg) => {
    const log = JSON.parse(msg.content.toString());
    console.log(`🗄️ DATABASE: ${log.message} (${msg.fields.routingKey})`);
    // Send to database monitoring team
    channel.ack(msg);
  });

  await channel.consume('all_application_logs', (msg) => {
    const log = JSON.parse(msg.content.toString());
    console.log(`📊 ALL LOGS: ${log.message} (${msg.fields.routingKey})`);
    // Store in main log aggregation system
    channel.ack(msg);
  });

  // Publish with hierarchical routing keys
  const logs = [
    {
      key: 'europe.critical.payment',
      message: 'Payment service down in London'
    },
    {
      key: 'usa.info.database',
      message: 'Database backup completed in New York'
    },
    {
      key: 'application.performance.frontend',
      message: 'Frontend response time increased'
    },
    {
      key: 'asia.critical.database',
      message: 'Database connection pool exhausted in Tokyo'
    }
  ];

  for (const log of logs) {
    await channel.publish('application_logs', log.key, 
      Buffer.from(JSON.stringify({
        message: log.message,
        timestamp: new Date().toISOString(),
        source: log.key
      })));
  }

  console.log('Topic exchange messages published');
}
```

### Pattern Matching Examples
```javascript
// Binding patterns and what they match:
'*.critical.*'           // europe.critical.payment ✅, usa.critical.database ✅
'europe.*.*'             // europe.critical.payment ✅, europe.info.database ✅
'*.*.database'           // usa.info.database ✅, asia.critical.database ✅
'application.#'          // application.performance.frontend ✅, application.error.auth.login ✅
'#.critical'             // any.path.critical ✅, very.long.path.to.critical ✅
```

### Best Use Cases
- Logging and monitoring systems
- Multi-tenant applications
- Geographic routing
- Hierarchical data processing

---

## 4. Headers Exchange

### How It Works
Routes messages based on **message header attributes** rather than routing keys. Uses `x-match` argument:
- `all` = ALL headers must match
- `any` = ANY header can match

### Characteristics
- ✅ **Most flexible** routing criteria
- ✅ Complex business logic routing
- ✅ Can ignore routing key entirely
- ❌ **Slowest** performance
- ❌ More complex setup

### Example Scenario
**Multi-criteria Order Routing** - Route based on customer type, region, and product category

```javascript
async function headersExchangeDemo() {
  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();

  // Create headers exchange
  await channel.assertExchange('order_routing', 'headers', { durable: true });

  // Create specialized queues
  await channel.assertQueue('vip_orders', { durable: true });
  await channel.assertQueue('europe_orders', { durable: true });
  await channel.assertQueue('electronics_orders', { durable: true });
  await channel.assertQueue('express_shipping', { durable: true });

  // Headers-based bindings
  
  // VIP customers (must match ALL criteria)
  await channel.bindQueue('vip_orders', 'order_routing', '', {
    'x-match': 'all',
    'customer_type': 'vip',
    'priority': 'high'
  });

  // European orders (must match ANY criteria)
  await channel.bindQueue('europe_orders', 'order_routing', '', {
    'x-match': 'any',
    'region': 'europe',
    'country': 'germany',
    'country': 'france'
  });

  // Electronics orders
  await channel.bindQueue('electronics_orders', 'order_routing', '', {
    'x-match': 'all',
    'category': 'electronics'
  });

  // Express shipping (multiple criteria)
  await channel.bindQueue('express_shipping', 'order_routing', '', {
    'x-match': 'any',
    'shipping': 'express',
    'customer_type': 'vip'
  });

  // Consumers
  await channel.consume('vip_orders', (msg) => {
    const order = JSON.parse(msg.content.toString());
    console.log(`👑 VIP ORDER: ${order.id} - Premium processing`);
    console.log(`   Headers: ${JSON.stringify(msg.properties.headers)}`);
    channel.ack(msg);
  });

  await channel.consume('europe_orders', (msg) => {
    const order = JSON.parse(msg.content.toString());
    console.log(`🇪🇺 EUROPE ORDER: ${order.id} - Regional processing`);
    console.log(`   Headers: ${JSON.stringify(msg.properties.headers)}`);
    channel.ack(msg);
  });

  await channel.consume('electronics_orders', (msg) => {
    const order = JSON.parse(msg.content.toString());
    console.log(`📱 ELECTRONICS ORDER: ${order.id} - Tech department`);
    console.log(`   Headers: ${JSON.stringify(msg.properties.headers)}`);
    channel.ack(msg);
  });

  await channel.consume('express_shipping', (msg) => {
    const order = JSON.parse(msg.content.toString());
    console.log(`🚀 EXPRESS SHIPPING: ${order.id} - Fast track`);
    console.log(`   Headers: ${JSON.stringify(msg.properties.headers)}`);
    channel.ack(msg);
  });

  // Publish messages with different header combinations
  const orders = [
    {
      order: { id: 'ORD-001', product: 'iPhone 15' },
      headers: {
        customer_type: 'vip',
        priority: 'high',
        category: 'electronics',
        region: 'usa'
      }
    },
    {
      order: { id: 'ORD-002', product: 'Book' },
      headers: {
        customer_type: 'regular',
        priority: 'normal',
        category: 'books',
        region: 'europe',
        country: 'germany'
      }
    },
    {
      order: { id: 'ORD-003', product: 'Laptop' },
      headers: {
        customer_type: 'business',
        priority: 'normal',
        category: 'electronics',
        shipping: 'express'
      }
    }
  ];

  for (const { order, headers } of orders) {
    await channel.publish('order_routing', '', 
      Buffer.from(JSON.stringify(order)),
      { headers }
    );
  }

  console.log('Headers exchange messages published');
}
```

### Header Matching Examples
```javascript
// Binding: { 'x-match': 'all', 'customer_type': 'vip', 'priority': 'high' }
// Message headers: { customer_type: 'vip', priority: 'high', region: 'usa' } ✅ MATCH

// Binding: { 'x-match': 'any', 'region': 'europe', 'shipping': 'express' }
// Message headers: { region: 'usa', shipping: 'express' } ✅ MATCH (shipping matches)

// Binding: { 'x-match': 'all', 'category': 'electronics', 'brand': 'apple' }
// Message headers: { category: 'electronics', brand: 'samsung' } ❌ NO MATCH
```

### Best Use Cases
- Complex business rules
- Multi-dimensional routing
- Legacy system integration
- Content-based routing

---

## Complete Comparison Demo

Here's a comprehensive demo showing all four exchange types working together:

```javascript
async function completeExchangeComparison() {
  const connection = await amqp.connect('amqp://localhost');
  const channel = await connection.createChannel();

  console.log('🚀 Setting up all exchange types...\n');

  // 1. DIRECT EXCHANGE
  await channel.assertExchange('direct_demo', 'direct');
  await channel.assertQueue('direct_queue_red');
  await channel.assertQueue('direct_queue_blue');
  await channel.bindQueue('direct_queue_red', 'direct_demo', 'red');
  await channel.bindQueue('direct_queue_blue', 'direct_demo', 'blue');

  await channel.consume('direct_queue_red', (msg) => {
    console.log(`🔴 DIRECT RED: ${msg.content.toString()}`);
    channel.ack(msg);
  });
  await channel.consume('direct_queue_blue', (msg) => {
    console.log(`🔵 DIRECT BLUE: ${msg.content.toString()}`);
    channel.ack(msg);
  });

  // 2. FANOUT EXCHANGE
  await channel.assertExchange('fanout_demo', 'fanout');
  await channel.assertQueue('fanout_queue_1');
  await channel.assertQueue('fanout_queue_2');
  await channel.bindQueue('fanout_queue_1', 'fanout_demo', '');
  await channel.bindQueue('fanout_queue_2', 'fanout_demo', '');

  await channel.consume('fanout_queue_1', (msg) => {
    console.log(`📢 FANOUT 1: ${msg.content.toString()}`);
    channel.ack(msg);
  });
  await channel.consume('fanout_queue_2', (msg) => {
    console.log(`📢 FANOUT 2: ${msg.content.toString()}`);
    channel.ack(msg);
  });

  // 3. TOPIC EXCHANGE
  await channel.assertExchange('topic_demo', 'topic');
  await channel.assertQueue('topic_queue_errors');
  await channel.assertQueue('topic_queue_all');
  await channel.bindQueue('topic_queue_errors', 'topic_demo', '*.error.*');
  await channel.bindQueue('topic_queue_all', 'topic_demo', 'app.#');

  await channel.consume('topic_queue_errors', (msg) => {
    console.log(`❌ TOPIC ERROR: ${msg.content.toString()} (${msg.fields.routingKey})`);
    channel.ack(msg);
  });
  await channel.consume('topic_queue_all', (msg) => {
    console.log(`📝 TOPIC ALL: ${msg.content.toString()} (${msg.fields.routingKey})`);
    channel.ack(msg);
  });

  // 4. HEADERS EXCHANGE
  await channel.assertExchange('headers_demo', 'headers');
  await channel.assertQueue('headers_queue_priority');
  await channel.bindQueue('headers_queue_priority', 'headers_demo', '', {
    'x-match': 'all',
    'priority': 'high',
    'type': 'urgent'
  });

  await channel.consume('headers_queue_priority', (msg) => {
    console.log(`🚨 HEADERS PRIORITY: ${msg.content.toString()}`);
    console.log(`   Headers: ${JSON.stringify(msg.properties.headers)}`);
    channel.ack(msg);
  });

  // Wait for consumers to be ready
  setTimeout(async () => {
    console.log('📤 Publishing messages to all exchanges...\n');

    // Direct exchange messages
    await channel.publish('direct_demo', 'red', Buffer.from('Direct message for RED'));
    await channel.publish('direct_demo', 'blue', Buffer.from('Direct message for BLUE'));
    
    // Fanout exchange message
    await channel.publish('fanout_demo', '', Buffer.from('Fanout broadcast message'));
    
    // Topic exchange messages
    await channel.publish('topic_demo', 'app.error.database', Buffer.from('Database error'));
    await channel.publish('topic_demo', 'app.info.startup', Buffer.from('App started'));
    
    // Headers exchange message
    await channel.publish('headers_demo', '', 
      Buffer.from('High priority urgent message'),
      { headers: { priority: 'high', type: 'urgent', source: 'system' } }
    );

    console.log('\n✅ All messages published!');
  }, 1000);

  // Cleanup
  setTimeout(() => {
    connection.close();
    process.exit(0);
  }, 3000);
}

// Run the complete comparison
completeExchangeComparison().catch(console.error);
```

## Performance Comparison

| Exchange Type | Routing Speed | Memory Usage | CPU Usage | Scalability |
|---------------|---------------|--------------|-----------|-------------|
| Direct | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Fanout | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Topic | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| Headers | ⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐ |

## Decision Matrix

**Choose Direct when:**
- Simple routing needs
- High performance required
- Predictable message flow
- Load balancing workers

**Choose Fanout when:**
- Broadcasting to multiple services
- Real-time notifications
- Cache invalidation
- Event-driven architecture

**Choose Topic when:**
- Hierarchical routing needed
- Logging and monitoring
- Multi-tenant applications
- Flexible subscription patterns

**Choose Headers when:**
- Complex business logic
- Multiple routing criteria
- Content-based routing
- Legacy system integration

Each exchange type serves different architectural needs. Choose based on your specific routing requirements, performance needs, and system complexity.

# RabbitMQ High Availability: Complete Implementation Guide

A comprehensive guide to building fault-tolerant, highly available RabbitMQ systems with clustering, replication, and disaster recovery strategies.

## Table of Contents
- [High Availability Overview](#high-availability-overview)
- [Clustering Setup](#clustering-setup)
- [Queue Mirroring](#queue-mirroring)
- [Client-Side HA](#client-side-ha)
- [Load Balancing](#load-balancing)
- [Monitoring & Health Checks](#monitoring--health-checks)
- [Disaster Recovery](#disaster-recovery)
- [Best Practices](#best-practices)

## High Availability Overview

### HA Components Stack
```
┌─────────────────────────────────────────┐
│              Load Balancer              │ ← HAProxy/Nginx
├─────────────────────────────────────────┤
│     RabbitMQ Cluster (3+ nodes)        │ ← Primary HA layer
├─────────────────────────────────────────┤
│     Mirrored Queues (Replication)      │ ← Data redundancy
├─────────────────────────────────────────┤
│     Client Connection Management       │ ← Failover logic
├─────────────────────────────────────────┤
│     Persistent Storage (Shared/Sync)   │ ← Data persistence
└─────────────────────────────────────────┘
```

### Key Metrics for HA
- **RTO (Recovery Time Objective)**: < 30 seconds
- **RPO (Recovery Point Objective)**: < 1 minute
- **Availability Target**: 99.9%+ (8.76 hours downtime/year)
- **Failover Time**: < 10 seconds

## Clustering Setup

### 1. Basic 3-Node Cluster Configuration

```bash
# Node 1 (rabbit-1.example.com)
# /etc/rabbitmq/rabbitmq.conf
cluster_formation.peer_discovery_backend = rabbit_peer_discovery_classic_config
cluster_formation.classic_config.nodes.1 = rabbit@rabbit-1
cluster_formation.classic_config.nodes.2 = rabbit@rabbit-2
cluster_formation.classic_config.nodes.3 = rabbit@rabbit-3

# Erlang cookie (must be identical on all nodes)
echo "shared_secret_cookie_here" > /var/lib/rabbitmq/.erlang.cookie
chmod 400 /var/lib/rabbitmq/.erlang.cookie

# Node configuration
loopback_users.guest = false
default_user = admin
default_pass = secure_password
default_permissions.configure = .*
default_permissions.read = .*
default_permissions.write = .*
```

### 2. Automated Cluster Setup Script

```bash
#!/bin/bash
# setup-rabbitmq-cluster.sh

NODES=("rabbit-1" "rabbit-2" "rabbit-3")
COOKIE="rabbitmq_cluster_cookie_$(date +%s)"

setup_node() {
    local node=$1
    local is_first=$2
    
    echo "Setting up RabbitMQ on $node..."
    
    ssh $node << EOF
        # Install RabbitMQ
        apt-get update
        apt-get install -y rabbitmq-server
        
        # Set Erlang cookie
        systemctl stop rabbitmq-server
        echo "$COOKIE" > /var/lib/rabbitmq/.erlang.cookie
        chmod 400 /var/lib/rabbitmq/.erlang.cookie
        chown rabbitmq:rabbitmq /var/lib/rabbitmq/.erlang.cookie
        
        # Configure node
        cat > /etc/rabbitmq/rabbitmq.conf << CONFIG
cluster_formation.peer_discovery_backend = rabbit_peer_discovery_classic_config
$(for i in "\${!NODES[@]}"; do
    echo "cluster_formation.classic_config.nodes.$((i+1)) = rabbit@\${NODES[i]}"
done)
cluster_partition_handling = autoheal
vm_memory_high_watermark.relative = 0.6
disk_free_limit.relative = 2.0
CONFIG
        
        # Start RabbitMQ
        systemctl start rabbitmq-server
        systemctl enable rabbitmq-server
        
        # Enable management plugin
        rabbitmq-plugins enable rabbitmq_management
        
        if [ "$is_first" != "true" ]; then
            # Join cluster
            rabbitmqctl stop_app
            rabbitmqctl join_cluster rabbit@${NODES[0]}
            rabbitmqctl start_app
        fi
        
        # Create admin user
        rabbitmqctl add_user admin secure_password || true
        rabbitmqctl set_user_tags admin administrator
        rabbitmqctl set_permissions -p / admin ".*" ".*" ".*"
EOF
}

# Setup first node
setup_node ${NODES[0]} true

# Setup remaining nodes
for node in "${NODES[@]:1}"; do
    setup_node $node false
done

echo "Cluster setup complete!"
```

### 3. Docker Compose Cluster

```yaml
# docker-compose.yml
version: '3.8'

services:
  rabbitmq-1:
    image: rabbitmq:3.12-management
    hostname: rabbitmq-1
    environment:
      RABBITMQ_ERLANG_COOKIE: "rabbitmq_cluster_cookie"
      RABBITMQ_DEFAULT_USER: "admin"
      RABBITMQ_DEFAULT_PASS: "secure_password"
    volumes:
      - ./rabbitmq-1-data:/var/lib/rabbitmq
      - ./cluster-config.conf:/etc/rabbitmq/rabbitmq.conf
    ports:
      - "5672:5672"
      - "15672:15672"
    networks:
      - rabbitmq-cluster

  rabbitmq-2:
    image: rabbitmq:3.12-management
    hostname: rabbitmq-2
    environment:
      RABBITMQ_ERLANG_COOKIE: "rabbitmq_cluster_cookie"
      RABBITMQ_DEFAULT_USER: "admin"
      RABBITMQ_DEFAULT_PASS: "secure_password"
    volumes:
      - ./rabbitmq-2-data:/var/lib/rabbitmq
      - ./cluster-config.conf:/etc/rabbitmq/rabbitmq.conf
    ports:
      - "5673:5672"
      - "15673:15672"
    networks:
      - rabbitmq-cluster
    depends_on:
      - rabbitmq-1

  rabbitmq-3:
    image: rabbitmq:3.12-management
    hostname: rabbitmq-3
    environment:
      RABBITMQ_ERLANG_COOKIE: "rabbitmq_cluster_cookie"
      RABBITMQ_DEFAULT_USER: "admin"
      RABBITMQ_DEFAULT_PASS: "secure_password"
    volumes:
      - ./rabbitmq-3-data:/var/lib/rabbitmq
      - ./cluster-config.conf:/etc/rabbitmq/rabbitmq.conf
    ports:
      - "5674:5672"
      - "15674:15672"
    networks:
      - rabbitmq-cluster
    depends_on:
      - rabbitmq-1

  haproxy:
    image: haproxy:2.8
    ports:
      - "5671:5671"  # RabbitMQ load balanced port
      - "8080:8080"  # HAProxy stats
    volumes:
      - ./haproxy.cfg:/usr/local/etc/haproxy/haproxy.cfg
    networks:
      - rabbitmq-cluster
    depends_on:
      - rabbitmq-1
      - rabbitmq-2
      - rabbitmq-3

networks:
  rabbitmq-cluster:
    driver: bridge

volumes:
  rabbitmq-1-data:
  rabbitmq-2-data:
  rabbitmq-3-data:
```

## Queue Mirroring & Replication

### 1. Classic Queue Mirroring (Legacy)

```bash
# Set policy for all queues to be mirrored on all nodes
rabbitmqctl set_policy ha-all ".*" '{"ha-mode":"all","ha-sync-mode":"automatic"}'

# Mirror specific queues to 2 nodes
rabbitmqctl set_policy ha-two "^critical\." '{"ha-mode":"exactly","ha-params":2,"ha-sync-mode":"automatic"}'

# Mirror based on node names
rabbitmqctl set_policy ha-nodes "^orders\." '{"ha-mode":"nodes","ha-params":["rabbit@node1","rabbit@node2"]}'
```

### 2. Quorum Queues (Recommended)

```javascript
const amqp = require('amqplib');

class HAQueueManager {
  constructor() {
    this.connections = [];
    this.channels = [];
  }

  async setupHA() {
    // Connect to multiple nodes
    const nodes = [
      'amqp://admin:secure_password@rabbit-1:5672',
      'amqp://admin:secure_password@rabbit-2:5672',
      'amqp://admin:secure_password@rabbit-3:5672'
    ];

    for (const url of nodes) {
      try {
        const connection = await amqp.connect(url);
        const channel = await connection.createChannel();
        
        this.connections.push(connection);
        this.channels.push(channel);
        
        console.log(`✅ Connected to ${url}`);
      } catch (error) {
        console.warn(`⚠️ Failed to connect to ${url}: ${error.message}`);
      }
    }

    if (this.channels.length === 0) {
      throw new Error('No RabbitMQ nodes available');
    }

    return this.channels[0]; // Use first available channel
  }

  async createQuorumQueue(queueName, options = {}) {
    const channel = this.channels[0];
    
    // Quorum queue configuration
    const args = {
      'x-queue-type': 'quorum',
      'x-quorum-initial-group-size': 3,
      'x-max-length': 10000,
      'x-overflow': 'reject-publish',
      ...options
    };

    await channel.assertQueue(queueName, {
      durable: true,
      arguments: args
    });

    console.log(`✅ Quorum queue '${queueName}' created`);
    return queueName;
  }

  async createStreamQueue(queueName, options = {}) {
    const channel = this.channels[0];
    
    // Stream queue configuration (RabbitMQ 3.9+)
    const args = {
      'x-queue-type': 'stream',
      'x-max-length-bytes': 20000000000, // 20GB
      'x-max-age': '7D', // 7 days retention
      'x-stream-max-segment-size-bytes': 500000000, // 500MB segments
      ...options
    };

    await channel.assertQueue(queueName, {
      durable: true,
      arguments: args
    });

    console.log(`✅ Stream queue '${queueName}' created`);
    return queueName;
  }
}

// Usage example
async function setupHAQueues() {
  const haManager = new HAQueueManager();
  await haManager.setupHA();

  // Create different types of HA queues
  await haManager.createQuorumQueue('critical_orders', {
    'x-dead-letter-exchange': 'dlx',
    'x-dead-letter-routing-key': 'failed'
  });

  await haManager.createQuorumQueue('payment_processing', {
    'x-max-length': 5000,
    'x-overflow': 'reject-publish'
  });

  await haManager.createStreamQueue('audit_logs', {
    'x-max-age': '30D'
  });

  console.log('All HA queues created successfully');
}
```

## Client-Side HA Implementation

### 1. Connection Pooling & Failover

```javascript
const amqp = require('amqplib');
const EventEmitter = require('events');

class HAConnection extends EventEmitter {
  constructor(nodes, options = {}) {
    super();
    this.nodes = nodes;
    this.currentIndex = 0;
    this.connection = null;
    this.channel = null;
    this.isConnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.reconnectDelay = options.reconnectDelay || 5000;
    this.heartbeat = options.heartbeat || 60;
  }

  async connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    while (this.reconnectAttempts < this.maxReconnectAttempts) {
      const nodeUrl = this.nodes[this.currentIndex];
      
      try {
        console.log(`🔄 Attempting to connect to ${nodeUrl} (attempt ${this.reconnectAttempts + 1})`);
        
        this.connection = await amqp.connect(nodeUrl, {
          heartbeat: this.heartbeat
        });
        
        this.channel = await this.connection.createChannel();
        
        // Setup connection event handlers
        this.connection.on('error', (err) => {
          console.error(`❌ Connection error: ${err.message}`);
          this.handleConnectionError();
        });
        
        this.connection.on('close', () => {
          console.warn('⚠️ Connection closed');
          this.handleConnectionError();
        });

        // Setup channel event handlers
        this.channel.on('error', (err) => {
          console.error(`❌ Channel error: ${err.message}`);
        });

        this.channel.on('close', () => {
          console.warn('⚠️ Channel closed');
        });

        console.log(`✅ Connected to ${nodeUrl}`);
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.emit('connected');
        return this.channel;
        
      } catch (error) {
        console.error(`❌ Failed to connect to ${nodeUrl}: ${error.message}`);
        this.reconnectAttempts++;
        this.currentIndex = (this.currentIndex + 1) % this.nodes.length;
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          console.log(`⏳ Waiting ${this.reconnectDelay}ms before next attempt...`);
          await this.sleep(this.reconnectDelay);
        }
      }
    }
    
    this.isConnecting = false;
    throw new Error('Max reconnection attempts reached');
  }

  async handleConnectionError() {
    if (this.connection) {
      try {
        await this.connection.close();
      } catch (e) {
        // Ignore close errors
      }
    }
    
    this.connection = null;
    this.channel = null;
    this.emit('disconnected');
    
    // Attempt reconnection
    setTimeout(() => {
      this.connect().catch(err => {
        console.error('Reconnection failed:', err.message);
        this.emit('reconnect_failed', err);
      });
    }, this.reconnectDelay);
  }

  async publish(exchange, routingKey, content, options = {}) {
    if (!this.channel) {
      await this.connect();
    }

    try {
      const published = this.channel.publish(
        exchange, 
        routingKey, 
        Buffer.from(JSON.stringify(content)),
        { persistent: true, ...options }
      );
      
      if (!published) {
        throw new Error('Publish failed - channel flow control');
      }
      
      return true;
    } catch (error) {
      console.error('Publish error:', error.message);
      await this.handleConnectionError();
      throw error;
    }
  }

  async consume(queue, callback, options = {}) {
    if (!this.channel) {
      await this.connect();
    }

    try {
      await this.channel.consume(queue, (msg) => {
        if (msg) {
          try {
            callback(msg);
            this.channel.ack(msg);
          } catch (error) {
            console.error('Message processing error:', error.message);
            this.channel.nack(msg, false, false); // Send to DLQ
          }
        }
      }, { noAck: false, ...options });
      
      console.log(`👂 Started consuming from ${queue}`);
    } catch (error) {
      console.error('Consume error:', error.message);
      await this.handleConnectionError();
      throw error;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async close() {
    if (this.connection) {
      await this.connection.close();
    }
  }
}

// Usage example
async function useHAConnection() {
  const nodes = [
    'amqp://admin:password@rabbit-1:5672',
    'amqp://admin:password@rabbit-2:5672',
    'amqp://admin:password@rabbit-3:5672'
  ];

  const haConn = new HAConnection(nodes, {
    maxReconnectAttempts: 10,
    reconnectDelay: 3000,
    heartbeat: 30
  });

  // Event handlers
  haConn.on('connected', () => {
    console.log('🎉 HA Connection established');
  });

  haConn.on('disconnected', () => {
    console.log('⚠️ HA Connection lost');
  });

  haConn.on('reconnect_failed', (error) => {
    console.error('💥 Reconnection failed:', error.message);
  });

  try {
    await haConn.connect();
    
    // Setup consumer
    await haConn.consume('ha_test_queue', (msg) => {
      const data = JSON.parse(msg.content.toString());
      console.log('📦 Received:', data);
    });

    // Publish messages
    setInterval(async () => {
      try {
        await haConn.publish('', 'ha_test_queue', {
          message: 'HA test message',
          timestamp: new Date().toISOString()
        });
        console.log('📤 Message published');
      } catch (error) {
        console.error('Publish failed:', error.message);
      }
    }, 5000);

  } catch (error) {
    console.error('HA Connection failed:', error.message);
  }
}
```

### 2. Circuit Breaker Pattern

```javascript
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.timeout = options.timeout || 60000;
    this.monitoringPeriod = options.monitoringPeriod || 10000;
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = null;
  }

  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
    }
  }

  getState() {
    return this.state;
  }
}

// Usage with RabbitMQ
class HAPublisher {
  constructor(nodes) {
    this.haConnection = new HAConnection(nodes);
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      timeout: 30000,
      monitoringPeriod: 5000
    });
  }

  async publish(exchange, routingKey, message) {
    return this.circuitBreaker.execute(async () => {
      return this.haConnection.publish(exchange, routingKey, message);
    });
  }
}
```

## Load Balancing Configuration

### 1. HAProxy Configuration

```bash
# haproxy.cfg
global
    log stdout local0
    chroot /var/lib/haproxy
    stats socket /run/haproxy/admin.sock mode 660 level admin
    stats timeout 30s
    user haproxy
    group haproxy
    daemon

defaults
    mode tcp
    timeout connect 5000ms
    timeout client 50000ms
    timeout server 50000ms
    option tcplog
    log global

# RabbitMQ cluster load balancing
frontend rabbitmq_frontend
    bind *:5671
    default_backend rabbitmq_backend

backend rabbitmq_backend
    balance roundrobin
    option tcp-check
    tcp-check connect port 5672
    
    # Health check with RabbitMQ management API
    option httpchk GET /api/healthchecks/node
    http-check expect status 200
    
    server rabbit-1 rabbit-1:5672 check inter 5s rise 2 fall 3 maxconn 100
    server rabbit-2 rabbit-2:5672 check inter 5s rise 2 fall 3 maxconn 100
    server rabbit-3 rabbit-3:5672 check inter 5s rise 2 fall 3 maxconn 100

# Management UI load balancing
frontend rabbitmq_mgmt_frontend
    bind *:15671
    mode http
    default_backend rabbitmq_mgmt_backend

backend rabbitmq_mgmt_backend
    mode http
    balance roundrobin
    option httpchk GET /api/overview
    http-check expect status 200
    
    server rabbit-1-mgmt rabbit-1:15672 check inter 10s
    server rabbit-2-mgmt rabbit-2:15672 check inter 10s
    server rabbit-3-mgmt rabbit-3:15672 check inter 10s

# Statistics page
frontend stats
    bind *:8080
    stats enable
    stats uri /
    stats refresh 30s
    stats admin if TRUE
```

### 2. Nginx Load Balancer

```nginx
# nginx.conf
upstream rabbitmq_cluster {
    least_conn;
    server rabbit-1:5672 max_fails=3 fail_timeout=30s;
    server rabbit-2:5672 max_fails=3 fail_timeout=30s;
    server rabbit-3:5672 max_fails=3 fail_timeout=30s;
}

upstream rabbitmq_mgmt {
    ip_hash;
    server rabbit-1:15672;
    server rabbit-2:15672;
    server rabbit-3:15672;
}

server {
    listen 5671;
    proxy_pass rabbitmq_cluster;
    proxy_timeout 1s;
    proxy_responses 1;
    error_log /var/log/nginx/rabbitmq.log;
}

server {
    listen 15671;
    location / {
        proxy_pass http://rabbitmq_mgmt;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## Monitoring & Health Checks

### 1. Comprehensive Health Check System

```javascript
const axios = require('axios');
const amqp = require('amqplib');

class RabbitMQHealthMonitor {
  constructor(nodes, credentials) {
    this.nodes = nodes;
    this.credentials = credentials;
    this.healthStatus = new Map();
  }

  async checkNodeHealth(node) {
    const results = {
      node,
      timestamp: new Date().toISOString(),
      isHealthy: true,
      checks: {}
    };

    try {
      // 1. Management API health check
      results.checks.api = await this.checkManagementAPI(node);
      
      // 2. AMQP connection check
      results.checks.amqp = await this.checkAMQPConnection(node);
      
      // 3. Cluster status check
      results.checks.cluster = await this.checkClusterStatus(node);
      
      // 4. Queue status check
      results.checks.queues = await this.checkQueueStatus(node);
      
      // 5. Memory and disk check
      results.checks.resources = await this.checkResources(node);

      results.isHealthy = Object.values(results.checks).every(check => check.status === 'healthy');
      
    } catch (error) {
      results.isHealthy = false;
      results.error = error.message;
    }

    this.healthStatus.set(node.name, results);
    return results;
  }

  async checkManagementAPI(node) {
    try {
      const response = await axios.get(
        `http://${node.host}:${node.mgmtPort}/api/healthchecks/node`,
        {
          auth: this.credentials,
          timeout: 5000
        }
      );
      
      return {
        status: response.status === 200 ? 'healthy' : 'unhealthy',
        responseTime: response.headers['x-response-time'] || 'N/A'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  async checkAMQPConnection(node) {
    try {
      const url = `amqp://${this.credentials.username}:${this.credentials.password}@${node.host}:${node.amqpPort}`;
      const connection = await amqp.connect(url);
      const channel = await connection.createChannel();
      
      // Test queue operations
      const testQueue = `health_check_${Date.now()}`;
      await channel.assertQueue(testQueue, { durable: false, autoDelete: true });
      await channel.deleteQueue(testQueue);
      
      await connection.close();
      
      return { status: 'healthy' };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  async checkClusterStatus(node) {
    try {
      const response = await axios.get(
        `http://${node.host}:${node.mgmtPort}/api/nodes`,
        {
          auth: this.credentials,
          timeout: 5000
        }
      );

      const nodes = response.data;
      const runningNodes = nodes.filter(n => n.running);
      const totalNodes = nodes.length;

      return {
        status: runningNodes.length >= Math.ceil(totalNodes / 2) ? 'healthy' : 'unhealthy',
        runningNodes: runningNodes.length,
        totalNodes,
        details: nodes.map(n => ({
          name: n.name,
          running: n.running,
          uptime: n.uptime
        }))
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  async checkQueueStatus(node) {
    try {
      const response = await axios.get(
        `http://${node.host}:${node.mgmtPort}/api/queues`,
        {
          auth: this.credentials,
          timeout: 5000
        }
      );

      const queues = response.data;
      const unhealthyQueues = queues.filter(q => 
        q.state !== 'running' || 
        (q.messages > 10000) || // High message count threshold
        (q.memory > 100000000) // High memory usage threshold (100MB)
      );

      return {
        status: unhealthyQueues.length === 0 ? 'healthy' : 'warning',
        totalQueues: queues.length,
        unhealthyQueues: unhealthyQueues.length,
        details: unhealthyQueues.map(q => ({
          name: q.name,
          state: q.state,
          messages: q.messages,
          memory: q.memory
        }))
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  async checkResources(node) {
    try {
      const response = await axios.get(
        `http://${node.host}:${node.mgmtPort}/api/nodes/${node.name}`,
        {
          auth: this.credentials,
          timeout: 5000
        }
      );

      const nodeData = response.data;
      const memoryUsage = nodeData.mem_used / nodeData.mem_limit;
      const diskFree = nodeData.disk_free;

      return {
        status: memoryUsage < 0.8 && diskFree > 1000000000 ? 'healthy' : 'warning', // 80% memory, 1GB disk
        memoryUsage: Math.round(memoryUsage * 100),
        diskFree: Math.round(diskFree / 1000000000), // GB
        details: {
          memLimit: nodeData.mem_limit,
          memUsed: nodeData.mem_used,
          diskFree: nodeData.disk_free
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  async monitorCluster() {
    console.log('🏥 Starting RabbitMQ health monitoring...');
    
    const checkInterval = setInterval(async () => {
      const healthPromises = this.nodes.map(node => this.checkNodeHealth(node));
      const results = await Promise.allSettled(healthPromises);
      
      console.log('\n📊 Health Check Results:');
      console.log('================================');
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const health = result.value;
          const status = health.isHealthy ? '✅' : '❌';
          console.log(`${status} ${health.node.name}: ${health.isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
          
          if (!health.isHealthy) {
            console.log(`   Error: ${health.error || 'Multiple check failures'}`);
            Object.entries(health.checks).forEach(([check, result]) => {
              if (result.status !== 'healthy') {
                console.log(`   - ${check}: ${result.status} (${result.error || 'Failed'})`);
              }
            });
          }
        } else {
          console.log(`❌ ${this.nodes[index].name}: MONITOR_ERROR - ${result.reason}`);
        }
      });
      
      // Check overall cluster health
      const healthyNodes = results
        .filter(r => r.status === 'fulfilled' && r.value.isHealthy)
        .length;
      
      const clusterHealth = healthyNodes >= Math.ceil(this.nodes.length / 2);
      console.log(`\n🔍 Cluster Status: ${clusterHealth ? '✅ HEALTHY' : '❌ DEGRADED'} (${healthyNodes}/${this.nodes.length} nodes healthy)`);
      
      if (!clusterHealth) {
        console.log('🚨 ALERT: Cluster is in degraded state!');
        await this.sendAlert('CLUSTER_DEGRADED', `Only ${healthyNodes}/${this.nodes.length} nodes are healthy`);
      }
      
    }, 30000); // Check every 30 seconds

    return checkInterval;
  }

  async sendAlert(type, message) {
    // Implement your alerting mechanism here
    console.log(`🚨 ALERT [${type}]: ${message}`);
    // Could send to Slack, email, PagerDuty, etc.
  }

  getClusterHealth() {
    return Array.from(this.healthStatus.values());
  }
}

// Usage example
async function startHealthMonitoring() {
  const nodes = [
    { name: 'rabbit@rabbit-1', host: 'rabbit-1', amqpPort: 5672, mgmtPort: 15672 },
    { name: 'rabbit@rabbit-2', host: 'rabbit-2', amqpPort: 5672, mgmtPort: 15672 },
    { name: 'rabbit@rabbit-3', host: 'rabbit-3', amqpPort: 5672, mgmtPort: 15672 }
  ];

  const credentials = {
    username: 'admin',
    password: 'secure_password'
  };

  const monitor = new RabbitMQHealthMonitor(nodes, credentials);
  await monitor.monitorCluster();
}
```

### 2. Prometheus Metrics Integration

```javascript
const prometheus = require('prom-client');

class RabbitMQMetrics {
  constructor() {
    // Create metrics
    this.nodeUpGauge = new prometheus.Gauge({
      name: 'rabbitmq_node_up',
      help: 'Whether RabbitMQ node is up',
      labelNames: ['node', 'cluster']
    });

    this.queueMessagesGauge = new prometheus.Gauge({
      name: 'rabbitmq_queue_messages',
      help: 'Number of messages in queue',
      labelNames: ['queue', 'vhost', 'node']
    });

    this.connectionCountGauge = new prometheus.Gauge({
      name: 'rabbitmq_connections',
      help: 'Number of connections',
      labelNames: ['node', 'state']
    });

    this.memoryUsageGauge = new prometheus.Gauge({
      name: 'rabbitmq_memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['node']
    });

    // Register metrics
    prometheus.register.registerMetric(this.nodeUpGauge);
    prometheus.register.registerMetric(this.queueMessagesGauge);
    prometheus.register.registerMetric(this.connectionCountGauge);
    prometheus.register.registerMetric(this.memoryUsageGauge);
  }

  updateNodeMetrics(node, isUp, memoryUsed, connections) {
    this.nodeUpGauge.set({ node: node.name, cluster: 'main' }, isUp ? 1 : 0);
    this.memoryUsageGauge.set({ node: node.name }, memoryUsed);
    this.connectionCountGauge.set({ node: node.name, state: 'running' }, connections);
  }

  updateQueueMetrics(queue, node) {
    this.queueMessagesGauge.set({
      queue: queue.name,
      vhost: queue.vhost,
      node: node
    }, queue.messages);
  }

  getMetrics() {
    return prometheus.register.metrics();
  }
}
```

## Disaster Recovery

### 1. Automated Backup Strategy

```bash
#!/bin/bash
# rabbitmq-backup.sh

BACKUP_DIR="/backup/rabbitmq"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Function to backup RabbitMQ
backup_rabbitmq() {
    local node=$1
    local backup_path="$BACKUP_DIR/$node/$DATE"
    
    echo "Creating backup for $node..."
    mkdir -p "$backup_path"
    
    # Export definitions (exchanges, queues, bindings, users, etc.)
    rabbitmqctl export_definitions "$backup_path/definitions.json"
    
    # Backup Erlang data directory
    tar -czf "$backup_path/data_backup.tar.gz" /var/lib/rabbitmq/mnesia
    
    # Backup configuration
    cp -r /etc/rabbitmq "$backup_path/config"
    
    # Create backup metadata
    cat > "$backup_path/metadata.json" << EOF
{
    "backup_date": "$DATE",
    "node": "$node",
    "rabbitmq_version": "$(rabbitmqctl version)",
    "cluster_status": $(rabbitmqctl cluster_status --formatter json)
}
EOF
    
    echo "Backup completed for $node: $backup_path"
}

# Function to sync backup to remote storage
sync_to_remote() {
    local backup_path=$1
    
    # Sync to AWS S3
    aws s3 sync "$backup_path" "s3://company-rabbitmq-backups/$(basename $backup_path)/" \
        --storage-class STANDARD_IA
    
    # Or sync to another server
    # rsync -av "$backup_path" backup-server:/backups/rabbitmq/
}

# Function to cleanup old backups
cleanup_old_backups() {
    find "$BACKUP_DIR" -type d -mtime +$RETENTION_DAYS -exec rm -rf {} \;
}

# Main backup process
main() {
    echo "Starting RabbitMQ backup process..."
    
    # Get cluster nodes
    NODES=($(rabbitmqctl cluster_status --formatter json | jq -r '.running_nodes[]'))
    
    # Backup primary node (first in list)
    backup_rabbitmq "${NODES[0]}"
    
    # Sync to remote storage
    sync_to_remote "$BACKUP_DIR/${NODES[0]}/$DATE"
    
    # Cleanup old backups
    cleanup_old_backups
    
    echo "Backup process completed successfully"
}

main "$@"
```

### 2. Disaster Recovery Procedures

```bash
#!/bin/bash
# rabbitmq-restore.sh

restore_from_backup() {
    local backup_path=$1
    local target_node=$2
    
    echo "Starting restore process for $target_node from $backup_path"
    
    # Stop RabbitMQ
    systemctl stop rabbitmq-server
    
    # Clear existing data
    rm -rf /var/lib/rabbitmq/mnesia/*
    
    # Restore data
    tar -xzf "$backup_path/data_backup.tar.gz" -C /
    
    # Restore configuration
    cp -r "$backup_path/config/"* /etc/rabbitmq/
    
    # Start RabbitMQ
    systemctl start rabbitmq-server
    
    # Wait for startup
    sleep 30
    
    # Import definitions
    rabbitmqctl import_definitions "$backup_path/definitions.json"
    
    echo "Restore completed for $target_node"
}

# Automated failover script
automated_failover() {
    local failed_node=$1
    local backup_node=$2
    
    echo "Initiating automated failover from $failed_node to $backup_node"
    
    # Update load balancer to remove failed node
    curl -X POST "http://haproxy:8080/admin/disable_server" \
         -d "server=rabbitmq_backend/$failed_node"
    
    # Start backup node if not running
    if ! systemctl is-active --quiet rabbitmq-server; then
        systemctl start rabbitmq-server
    fi
    
    # Add backup node to load balancer
    curl -X POST "http://haproxy:8080/admin/enable_server" \
         -d "server=rabbitmq_backend/$backup_node"
    
    echo "Failover completed"
}
```

### 3. Cross-Region Replication

```javascript
// Cross-region federation setup
class CrossRegionReplication {
  constructor(regions) {
    this.regions = regions;
  }

  async setupFederation() {
    for (const region of this.regions) {
      await this.configureFederationUpstream(region);
      await this.setupFederationPolicies(region);
    }
  }

  async configureFederationUpstream(region) {
    const upstreams = this.regions.filter(r => r.name !== region.name);
    
    for (const upstream of upstreams) {
      const command = `
        rabbitmqctl set_parameter federation-upstream ${upstream.name} '{
          "uri": "amqp://${upstream.host}:5672",
          "ack-mode": "on-confirm",
          "trust-user-id": false,
          "max-hops": 1
        }'
      `;
      
      console.log(`Setting federation upstream for ${region.name} -> ${upstream.name}`);
      // Execute command on region's RabbitMQ cluster
    }
  }

  async setupFederationPolicies(region) {
    // Federate critical queues across regions
    const policies = [
      {
        name: 'federate-critical-queues',
        pattern: '^critical\\.',
        definition: { 'federation-upstream-set': 'all' }
      },
      {
        name: 'federate-user-events',
        pattern: '^user\\.events\\.',
        definition: { 'federation-upstream-set': 'all' }
      }
    ];

    for (const policy of policies) {
      const command = `
        rabbitmqctl set_policy ${policy.name} "${policy.pattern}" '${JSON.stringify(policy.definition)}'
      `;
      
      console.log(`Setting federation policy ${policy.name} for ${region.name}`);
      // Execute command on region's RabbitMQ cluster
    }
  }
}

// Usage
const regions = [
  { name: 'us-east', host: 'rabbit-us-east.company.com' },
  { name: 'eu-west', host: 'rabbit-eu-west.company.com' },
  { name: 'asia-pacific', host: 'rabbit-ap.company.com' }
];

const replication = new CrossRegionReplication(regions);
replication.setupFederation();
```

## Best Practices Summary

### 1. Architecture Best Practices

```yaml
# Production-ready cluster configuration
cluster_formation.peer_discovery_backend: rabbit_peer_discovery_k8s
cluster_formation.k8s.host: kubernetes.default.svc.cluster.local
cluster_formation.k8s.address_type: hostname
cluster_formation.k8s.service_name: rabbitmq-headless
cluster_formation.k8s.hostname_suffix: .rabbitmq-headless.default.svc.cluster.local

# Performance tuning
vm_memory_high_watermark.relative: 0.6
disk_free_limit.relative: 2.0
cluster_partition_handling: pause_minority

# Security
auth_backends.1: rabbit_auth_backend_ldap
auth_backends.2: rabbit_auth_backend_internal
ssl_options.cacertfile: /etc/ssl/certs/ca-certificates.crt
ssl_options.certfile: /etc/ssl/certs/server.pem
ssl_options.keyfile: /etc/ssl/private/server.key
ssl_options.verify: verify_peer
ssl_options.fail_if_no_peer_cert: true
```

### 2. Monitoring Checklist

- ✅ **Node Health**: CPU, memory, disk usage
- ✅ **Network Connectivity**: Inter-node communication
- ✅ **Queue Status**: Length, growth rate, consumer lag
- ✅ **Connection Monitoring**: Active connections, connection rate
- ✅ **Memory Alarms**: High watermark monitoring
- ✅ **Disk Space**: Free disk space monitoring
- ✅ **Cluster Partitions**: Split-brain detection
- ✅ **Federation Status**: Cross-region replication health

### 3. Operational Procedures

```javascript
// Production deployment checklist
const deploymentChecklist = {
  preDeployment: [
    'Verify cluster health',
    'Create configuration backup',
    'Check disk space (>20% free)',
    'Verify network connectivity',
    'Test failover procedures'
  ],
  
  deployment: [
    'Rolling update (one node at a time)',
    'Verify node rejoin after restart',
    'Check queue synchronization',
    'Monitor connection recovery',
    'Validate message flow'
  ],
  
  postDeployment: [
    'Full cluster health check',
    'Performance baseline verification',
    'End-to-end message flow test',
    'Update monitoring dashboards',
    'Document any configuration changes'
  ]
};

// Automated health validation
async function validateClusterHealth() {
  const checks = [
    () => checkAllNodesRunning(),
    () => checkQuorumQueuesHealthy(),
    () => checkMemoryUsage(),
    () => checkDiskSpace(),
    () => checkNetworkPartitions(),
    () => checkMessageFlow()
  ];

  const results = await Promise.allSettled(checks.map(check => check()));
  const failures = results.filter(r => r.status === 'rejected');
  
  if (failures.length > 0) {
    throw new Error(`Health check failed: ${failures.length} checks failed`);
  }
  
  console.log('✅ All health checks passed');
  return true;
}
```

### 4. Scaling Considerations

```javascript
// Dynamic scaling based on metrics
class AutoScaler {
  constructor(cluster) {
    this.cluster = cluster;
    this.scaleUpThreshold = 0.8;  // 80% resource usage
    this.scaleDownThreshold = 0.3; // 30% resource usage
    this.cooldownPeriod = 300000; // 5 minutes
    this.lastScaleAction = 0;
  }

  async evaluateScaling() {
    const metrics = await this.cluster.getMetrics();
    const avgCpuUsage = metrics.nodes.reduce((sum, node) => sum + node.cpu, 0) / metrics.nodes.length;
    const avgMemoryUsage = metrics.nodes.reduce((sum, node) => sum + node.memory, 0) / metrics.nodes.length;
    
    const now = Date.now();
    const canScale = (now - this.lastScaleAction) > this.cooldownPeriod;
    
    if (!canScale) return;
    
    if (avgCpuUsage > this.scaleUpThreshold || avgMemoryUsage > this.scaleUpThreshold) {
      await this.scaleUp();
    } else if (avgCpuUsage < this.scaleDownThreshold && avgMemoryUsage < this.scaleDownThreshold) {
      await this.scaleDown();
    }
  }

  async scaleUp() {
    if (this.cluster.nodeCount >= this.cluster.maxNodes) return;
    
    console.log('🚀 Scaling up cluster...');
    await this.cluster.addNode();
    this.lastScaleAction = Date.now();
  }

  async scaleDown() {
    if (this.cluster.nodeCount <= this.cluster.minNodes) return;
    
    console.log('📉 Scaling down cluster...');
    await this.cluster.removeNode();
    this.lastScaleAction = Date.now();
  }
}
```

## Conclusion

This comprehensive HA setup provides:

- **99.9%+ Availability** through clustering and redundancy
- **Automatic Failover** with circuit breakers and connection pooling
- **Real-time Monitoring** with health checks and alerting
- **Disaster Recovery** with automated backups and restore procedures
- **Cross-region Replication** for global resilience
- **Performance Optimization** through load balancing and resource monitoring

The combination of these strategies ensures your RabbitMQ infrastructure can handle failures gracefully while maintaining message delivery guarantees and system performance.

# RabbitMQ Priority Queue Implementation with Node.js

A complete guide to implementing and using priority queues with RabbitMQ in Node.js applications.

## 📋 Table of Contents

- [Overview](#overview)
- [Key Concepts](#key-concepts)
- [Installation & Setup](#installation--setup)
- [How to Define Priority](#how-to-define-priority)
- [How to Handle Priority Messages](#how-to-handle-priority-messages)
- [Implementation Examples](#implementation-examples)
- [Best Practices](#best-practices)
- [Common Pitfalls](#common-pitfalls)
- [Performance Considerations](#performance-considerations)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

Priority queues in RabbitMQ allow messages with higher priority values to be processed before lower priority ones. This is essential for applications that need to handle urgent tasks, critical notifications, or time-sensitive operations.

### What RabbitMQ Does Automatically ✅
- Sorts messages by priority when they arrive
- Selects highest priority message for delivery
- Maintains priority order within queue data structure
- Handles tie-breaking (same priority = FIFO order)

### What You Need to Configure 🔧
- Queue declaration with `x-max-priority`
- Message priority assignment
- Consumer `prefetch(1)` settings
- Priority handling logic

## 🔑 Key Concepts

### Priority Values
- **Range**: 0 to `x-max-priority` (typically 0-10)
- **Higher number = Higher priority**: Priority 10 > Priority 5 > Priority 0
- **Default**: Messages without priority = Priority 0
- **Tie-breaking**: Same priority messages use FIFO order

### Consumer Behavior
- **prefetch(1)**: Ensures strict priority ordering (recommended)
- **prefetch(N)**: Can break priority order due to message buffering
- **Automatic delivery**: RabbitMQ automatically selects highest priority message

## 🚀 Installation & Setup

### 1. Install Dependencies

```bash
npm install amqplib
```

### 2. Install RabbitMQ Server

```bash
# macOS
brew install rabbitmq
rabbitmq-server

# Ubuntu
sudo apt-get install rabbitmq-server
sudo systemctl start rabbitmq-server

# Docker
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

## 🎯 How to Define Priority

### 1. Queue Declaration with Priority Support

```javascript
await channel.assertQueue('priority-queue', {
  durable: true,
  arguments: {
    'x-max-priority': 10  // Maximum priority level (0-10)
  }
});
```

### 2. Message Publishing with Priority

```javascript
// High priority message
await channel.sendToQueue('priority-queue', Buffer.from(JSON.stringify({
  task: 'Critical system alert',
  data: 'Server down!'
})), {
  priority: 10,    // Highest priority
  persistent: true
});

// Medium priority message
await channel.sendToQueue('priority-queue', Buffer.from(JSON.stringify({
  task: 'Process user registration',
  data: 'user@example.com'
})), {
  priority: 5,     // Medium priority
  persistent: true
});

// Low priority message (or no priority specified = 0)
await channel.sendToQueue('priority-queue', Buffer.from(JSON.stringify({
  task: 'Generate monthly report',
  data: 'analytics_data'
})), {
  priority: 1,     // Low priority
  persistent: true
});
```

### 3. Priority Assignment Strategy

```javascript
const PRIORITIES = {
  CRITICAL: 10,    // System alerts, emergencies
  HIGH: 8,         // Urgent user requests
  NORMAL: 5,       // Regular operations
  LOW: 2,          // Background tasks
  BATCH: 1         // Bulk operations
};

// Usage example
async function publishTask(taskType, message) {
  let priority;
  
  switch(taskType) {
    case 'system_alert':
      priority = PRIORITIES.CRITICAL;
      break;
    case 'user_request':
      priority = PRIORITIES.HIGH;
      break;
    case 'background_job':
      priority = PRIORITIES.LOW;
      break;
    default:
      priority = PRIORITIES.NORMAL;
  }
  
  await channel.sendToQueue('tasks', Buffer.from(JSON.stringify(message)), {
    priority: priority,
    persistent: true
  });
}
```

## ⚡ How to Handle Priority Messages

### 1. Basic Priority Consumer Setup

```javascript
const amqp = require('amqplib');

class PriorityConsumer {
  async setupConsumer() {
    // Connect
    this.connection = await amqp.connect('amqp://localhost');
    this.channel = await this.connection.createChannel();
    
    // CRITICAL: Set prefetch to 1 for strict priority ordering
    await this.channel.prefetch(1);
    
    // Start consuming
    await this.channel.consume('priority-queue', async (msg) => {
      if (msg !== null) {
        await this.handleMessage(msg);
      }
    });
  }
  
  async handleMessage(msg) {
    const message = JSON.parse(msg.content.toString());
    const priority = msg.properties.priority || 0;
    
    console.log(`Processing priority ${priority}: ${message.task}`);
    
    try {
      // Route to appropriate handler based on priority
      await this.routeByPriority(message, priority);
      
      // Acknowledge successful processing
      this.channel.ack(msg);
    } catch (error) {
      console.error('Processing failed:', error);
      // Reject and don't requeue
      this.channel.nack(msg, false, false);
    }
  }
  
  async routeByPriority(message, priority) {
    if (priority >= 9) {
      await this.handleCritical(message);
    } else if (priority >= 6) {
      await this.handleHigh(message);
    } else if (priority >= 3) {
      await this.handleNormal(message);
    } else {
      await this.handleLow(message);
    }
  }
  
  async handleCritical(message) {
    // Immediate processing, alerts, notifications
    console.log('🚨 CRITICAL:', message.task);
    // Process immediately...
  }
  
  async handleHigh(message) {
    // Fast processing, user-facing operations
    console.log('⚡ HIGH PRIORITY:', message.task);
    // Process with higher resources...
  }
  
  async handleNormal(message) {
    // Standard processing
    console.log('📋 NORMAL:', message.task);
    // Standard processing...
  }
  
  async handleLow(message) {
    // Background processing, can be delayed
    console.log('🔄 LOW PRIORITY:', message.task);
    // Process when resources available...
  }
}
```

### 2. Advanced Handling with Multiple Consumers

```javascript
class ScalablePriorityHandler {
  async setupMultipleConsumers(queueName, consumerCount = 3) {
    const consumers = [];
    
    for (let i = 0; i < consumerCount; i++) {
      const connection = await amqp.connect('amqp://localhost');
      const channel = await connection.createChannel();
      
      // Each consumer processes one message at a time
      await channel.prefetch(1);
      
      await channel.consume(queueName, async (msg) => {
        if (msg !== null) {
          const message = JSON.parse(msg.content.toString());
          const priority = msg.properties.priority || 0;
          
          console.log(`Consumer ${i} processing priority ${priority}`);
          
          // Simulate processing time based on priority
          const processingTime = this.getProcessingTime(priority);
          await new Promise(resolve => setTimeout(resolve, processingTime));
          
          channel.ack(msg);
        }
      });
      
      consumers.push({ connection, channel });
    }
    
    return consumers;
  }
  
  getProcessingTime(priority) {
    // Higher priority = faster processing
    if (priority >= 8) return 100;  // Critical: 100ms
    if (priority >= 5) return 500;  // Normal: 500ms
    return 1000;                    // Low: 1000ms
  }
}
```

## 💻 Implementation Examples

### Complete Working Example

```javascript
const amqp = require('amqplib');

class PriorityQueueManager {
  constructor(rabbitMQUrl = 'amqp://localhost') {
    this.connection = null;
    this.channel = null;
    this.rabbitMQUrl = rabbitMQUrl;
  }

  async connect() {
    this.connection = await amqp.connect(this.rabbitMQUrl);
    this.channel = await this.connection.createChannel();
  }

  async createPriorityQueue(queueName, maxPriority = 10) {
    await this.channel.assertQueue(queueName, {
      durable: true,
      arguments: { 'x-max-priority': maxPriority }
    });
  }

  async publishMessage(queueName, message, priority = 0) {
    await this.channel.sendToQueue(
      queueName, 
      Buffer.from(JSON.stringify(message)), 
      { priority, persistent: true }
    );
  }

  async consumeMessages(queueName, messageHandler) {
    await this.channel.prefetch(1); // CRITICAL for priority ordering
    
    await this.channel.consume(queueName, async (msg) => {
      if (msg !== null) {
        const message = JSON.parse(msg.content.toString());
        const priority = msg.properties.priority || 0;
        
        await messageHandler(message, priority);
        this.channel.ack(msg);
      }
    });
  }

  async close() {
    if (this.channel) await this.channel.close();
    if (this.connection) await this.connection.close();
  }
}

// Usage
async function demo() {
  const qm = new PriorityQueueManager();
  await qm.connect();
  await qm.createPriorityQueue('tasks', 10);
  
  // Publish messages with different priorities
  await qm.publishMessage('tasks', { task: 'Low priority' }, 1);
  await qm.publishMessage('tasks', { task: 'High priority' }, 9);
  await qm.publishMessage('tasks', { task: 'Medium priority' }, 5);
  
  // Consume (will process in order: 9, 5, 1)
  await qm.consumeMessages('tasks', async (message, priority) => {
    console.log(`Processing priority ${priority}: ${message.task}`);
  });
}
```

## ✅ Best Practices

### 1. Priority Design Patterns

```javascript
// ✅ Good: Use meaningful priority levels
const PRIORITY = {
  SYSTEM_CRITICAL: 10,  // System failures, security alerts
  USER_CRITICAL: 8,     // Payment failures, account issues
  USER_URGENT: 6,       // Password resets, urgent requests
  NORMAL: 4,            // Regular user operations
  BACKGROUND: 2,        // Analytics, cleanup tasks
  BATCH: 1              // Bulk operations, reports
};

// ❌ Bad: Random priority values
const priority = Math.floor(Math.random() * 10); // Don't do this!
```

### 2. Queue Configuration

```javascript
// ✅ Good: Proper queue setup
await channel.assertQueue('priority-tasks', {
  durable: true,           // Survive server restarts
  arguments: {
    'x-max-priority': 10,  // Define max priority
    'x-message-ttl': 3600000  // Optional: message expiration
  }
});

// ✅ Good: Always set prefetch for priority queues
await channel.prefetch(1);
```

### 3. Error Handling

```javascript
// ✅ Good: Proper error handling with priority consideration
async function handleMessage(msg) {
  const priority = msg.properties.priority || 0;
  
  try {
    await processMessage(msg);
    channel.ack(msg);
  } catch (error) {
    if (priority >= 8) {
      // Critical messages: retry or alert
      console.error('Critical message failed:', error);
      // Send to dead letter queue or alert system
      channel.nack(msg, false, false);
    } else {
      // Lower priority: can be discarded
      channel.nack(msg, false, false);
    }
  }
}
```

## ⚠️ Common Pitfalls

### 1. Wrong Prefetch Settings

```javascript
// ❌ Bad: Breaks priority ordering
await channel.prefetch(10);

// ✅ Good: Maintains strict priority order
await channel.prefetch(1);
```

### 2. Missing Priority Values

```javascript
// ❌ Bad: All messages get priority 0
await channel.sendToQueue('queue', message);

// ✅ Good: Explicit priority assignment
await channel.sendToQueue('queue', message, { priority: 5 });
```

### 3. Incorrect Queue Declaration

```javascript
// ❌ Bad: No priority support
await channel.assertQueue('queue', { durable: true });

// ✅ Good: Enable priority support
await channel.assertQueue('queue', {
  durable: true,
  arguments: { 'x-max-priority': 10 }
});
```

## 📊 Performance Considerations

### Priority vs Throughput Trade-offs

| Configuration | Priority Accuracy | Throughput | Use Case |
|---------------|------------------|------------|----------|
| `prefetch(1)` | Perfect | Lower | Critical systems |
| `prefetch(5)` | Good | Higher | Balanced approach |
| `prefetch(10)` | Poor | Highest | High throughput needed |

### Scaling Strategies

1. **Horizontal Scaling**: Multiple consumers with `prefetch(1)`
2. **Priority-based Queues**: Separate queues for different priority levels
3. **Hybrid Approach**: Different prefetch settings for different priorities

## 🔧 Troubleshooting

### Common Issues and Solutions

**Issue**: Messages not processed in priority order
```javascript
// Solution: Check prefetch setting
await channel.prefetch(1); // Must be 1 for strict ordering
```

**Issue**: Priority not working at all
```javascript
// Solution: Verify queue has priority support
await channel.assertQueue('queue', {
  arguments: { 'x-max-priority': 10 } // Required!
});
```

**Issue**: All messages have same priority
```javascript
// Solution: Set priority when publishing
await channel.sendToQueue('queue', message, {
  priority: 5 // Don't forget this!
});
```

### Debugging Priority Queues

```javascript
// Add logging to verify priority handling
await channel.consume('queue', (msg) => {
  const priority = msg.properties.priority || 0;
  console.log(`Received message with priority: ${priority}`);
  console.log(`Queue length: ${msg.fields.messageCount}`);
  
  // Process message...
  channel.ack(msg);
});
```

## 📝 Summary

### Key Takeaways

1. **Automatic Priority Handling**: RabbitMQ automatically sorts and delivers messages by priority
2. **Configuration Required**: Must set `x-max-priority` on queue and priority on messages
3. **prefetch(1) Critical**: Essential for maintaining strict priority order
4. **Priority Strategy**: Design meaningful priority levels for your use case
5. **Error Handling**: Consider priority when handling failures and retries

### Quick Setup Checklist

- [ ] Install RabbitMQ and amqplib
- [ ] Declare queue with `x-max-priority`
- [ ] Set `prefetch(1)` on consumers
- [ ] Assign priority values when publishing
- [ ] Handle messages based on priority level
- [ ] Implement proper error handling
- [ ] Monitor and test priority ordering

### Sample Package.json

```json
{
  "name": "rabbitmq-priority-queue",
  "version": "1.0.0",
  "dependencies": {
    "amqplib": "^0.10.3"
  },
  "scripts": {
    "start": "node priority-queue.js",
    "producer": "node producer.js",
    "consumer": "node consumer.js"
  }
}
```

---

**Ready to implement priority queues in your Node.js application?** Start with the basic example above and customize based on your specific requirements!