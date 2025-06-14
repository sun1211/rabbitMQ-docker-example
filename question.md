# Complete RabbitMQ Guide with Node.js

A comprehensive, hands-on guide to mastering RabbitMQ messaging with practical Node.js examples and production-ready patterns.

## 📚 Table of Contents

### 🚀 Getting Started
- [What is RabbitMQ?](#what-is-rabbitmq)
- [Installation & Setup](#installation--setup)
- [Core Architecture](#core-architecture)

### 🔧 Core Components Deep Dive
- [Exchanges Explained](#exchanges-explained)
- [Queues in Detail](#queues-in-detail)
- [Bindings & Routing](#bindings--routing)

### 📡 Exchange Types Mastery
- [Direct Exchange](#direct-exchange)
- [Fanout Exchange](#fanout-exchange)
- [Topic Exchange](#topic-exchange)
- [Headers Exchange](#headers-exchange)

### 🎯 Advanced Features
- [Priority Queues](#priority-queues)
- [High Availability](#high-availability)
- [Clustering & Load Balancing](#clustering--load-balancing)

### 💼 Production Patterns
- [Error Handling & Dead Letter Queues](#error-handling--dead-letter-queues)
- [Monitoring & Health Checks](#monitoring--health-checks)
- [Best Practices](#best-practices)

---

## What is RabbitMQ?

RabbitMQ is a robust message broker that implements the Advanced Message Queuing Protocol (AMQP). Think of it as a sophisticated postal system for your applications:

```
Producer → Exchange → Queue → Consumer
    ↓         ↓        ↓        ↓
  📤 Sends   🔀 Routes  📦 Stores  📥 Processes
```

### Key Benefits
- **Reliability**: Message persistence and acknowledgments
- **Scalability**: Clustering and federation support
- **Flexibility**: Multiple exchange types and routing patterns
- **Monitoring**: Built-in management interface

---

## Installation & Setup

### 1. Install RabbitMQ Server

```bash
# macOS
brew install rabbitmq
brew services start rabbitmq

# Ubuntu/Debian
sudo apt-get install rabbitmq-server
sudo systemctl start rabbitmq-server

# Docker (Recommended for development)
docker run -d --name rabbitmq \
  -p 5672:5672 -p 15672:15672 \
  rabbitmq:3-management
```

### 2. Install Node.js Client

```bash
npm install amqplib
```

### 3. Basic Connection Test

```javascript
const amqp = require('amqplib');

async function testConnection() {
  try {
    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();
    
    console.log('✅ Connected to RabbitMQ successfully!');
    
    await connection.close();
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  }
}

testConnection();
```

---

## Core Architecture

### The Three Pillars

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  EXCHANGES  │───▶│   BINDINGS  │───▶│   QUEUES    │
│             │    │             │    │             │
│ Route msgs  │    │ Link rules  │    │ Store msgs  │
│ by rules    │    │ & patterns  │    │ for consumers│
└─────────────┘    └─────────────┘    └─────────────┘
```

### Message Flow
1. **Producer** sends message to **Exchange**
2. **Exchange** uses **Bindings** to route to **Queues**
3. **Consumers** receive messages from **Queues**

---

## Exchanges Explained

### Exchange Types Comparison

| Type | Routing Method | When to Use | Performance |
|------|----------------|-------------|-------------|
| **Direct** | Exact key match | Simple routing, load balancing | ⭐⭐⭐⭐⭐ |
| **Fanout** | Broadcast all | Notifications, real-time updates | ⭐⭐⭐⭐ |
| **Topic** | Pattern matching | Flexible routing, logging | ⭐⭐⭐ |
| **Headers** | Header attributes | Complex business logic | ⭐⭐ |

### Basic Exchange Setup

```javascript
const amqp = require('amqplib');

class ExchangeManager {
  async connect() {
    this.connection = await amqp.connect('amqp://localhost');
    this.channel = await this.connection.createChannel();
  }

  async createExchange(name, type, options = {}) {
    await this.channel.assertExchange(name, type, {
      durable: true,
      ...options
    });
    console.log(`✅ Created ${type} exchange: ${name}`);
  }
}
```

---

## Direct Exchange

**Perfect for**: Task distribution, load balancing, simple routing

### How It Works
Routes messages where the routing key **exactly matches** the binding key.

```javascript
class DirectExchangeDemo {
  async setup() {
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

    return { connection, channel };
  }

  async publishOrder(channel, orderType, orderData) {
    await channel.publish('order_processing', orderType, 
      Buffer.from(JSON.stringify(orderData)));
    console.log(`📤 Published ${orderType} order`);
  }

  async consumeOrders(channel, queueName, processingFunction) {
    await channel.consume(queueName, (msg) => {
      if (msg) {
        const order = JSON.parse(msg.content.toString());
        processingFunction(order, queueName);
        channel.ack(msg);
      }
    });
  }
}

// Usage Example
async function runDirectDemo() {
  const demo = new DirectExchangeDemo();
  const { connection, channel } = await demo.setup();

  // Setup consumers
  await demo.consumeOrders(channel, 'express_orders', (order, queue) => {
    console.log(`🚀 EXPRESS: Processing order ${order.id} - Priority handling`);
  });

  await demo.consumeOrders(channel, 'standard_orders', (order, queue) => {
    console.log(`📦 STANDARD: Processing order ${order.id} - Normal handling`);
  });

  // Publish different order types
  await demo.publishOrder(channel, 'express', { id: 'ORD-001', customer: 'VIP' });
  await demo.publishOrder(channel, 'standard', { id: 'ORD-002', customer: 'Regular' });
}
```

---

## Fanout Exchange

**Perfect for**: Broadcasting, notifications, real-time updates

### How It Works
**Broadcasts messages to ALL bound queues**, ignoring routing keys.

```javascript
class FanoutExchangeDemo {
  async setupNotificationSystem() {
    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();

    // Create fanout exchange
    await channel.assertExchange('system_notifications', 'fanout', { durable: true });

    // Create service queues
    const services = ['email_service', 'sms_service', 'push_service', 'audit_service'];
    
    for (const service of services) {
      await channel.assertQueue(service, { durable: true });
      // Bind ALL queues to fanout (routing key ignored)
      await channel.bindQueue(service, 'system_notifications', '');
    }

    // Setup consumers
    services.forEach(service => {
      channel.consume(service, (msg) => {
        if (msg) {
          const notification = JSON.parse(msg.content.toString());
          console.log(`📢 ${service.toUpperCase()}: ${notification.message}`);
          channel.ack(msg);
        }
      });
    });

    return { connection, channel };
  }

  async broadcastNotification(channel, message) {
    const notification = {
      message,
      timestamp: new Date().toISOString(),
      id: Math.random().toString(36).substr(2, 9)
    };

    // Publish to fanout - routing key is ignored
    await channel.publish('system_notifications', '', 
      Buffer.from(JSON.stringify(notification)));
    
    console.log(`📡 Broadcasted: ${message}`);
  }
}

// Usage
async function runFanoutDemo() {
  const demo = new FanoutExchangeDemo();
  const { connection, channel } = await demo.setupNotificationSystem();

  // Broadcast system-wide notifications
  await demo.broadcastNotification(channel, 'System maintenance in 30 minutes');
  await demo.broadcastNotification(channel, 'New feature deployed successfully');
}
```

---

## Topic Exchange

**Perfect for**: Logging systems, multi-tenant apps, flexible routing

### How It Works
Routes using **pattern matching** with wildcards:
- `*` = exactly one word
- `#` = zero or more words

```javascript
class TopicExchangeDemo {
  async setupLoggingSystem() {
    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();

    // Create topic exchange
    await channel.assertExchange('application_logs', 'topic', { durable: true });

    // Create specialized log queues
    const queueBindings = [
      { queue: 'critical_alerts', pattern: '*.critical.*' },
      { queue: 'europe_logs', pattern: 'europe.*.*' },
      { queue: 'database_logs', pattern: '*.*.database' },
      { queue: 'all_app_logs', pattern: 'app.#' }
    ];

    for (const { queue, pattern } of queueBindings) {
      await channel.assertQueue(queue, { durable: true });
      await channel.bindQueue(queue, 'application_logs', pattern);
    }

    // Setup specialized consumers
    const consumers = {
      'critical_alerts': (log, key) => console.log(`🚨 CRITICAL: ${log.message} [${key}]`),
      'europe_logs': (log, key) => console.log(`🇪🇺 EUROPE: ${log.message} [${key}]`),
      'database_logs': (log, key) => console.log(`🗄️ DATABASE: ${log.message} [${key}]`),
      'all_app_logs': (log, key) => console.log(`📊 ALL LOGS: ${log.message} [${key}]`)
    };

    Object.entries(consumers).forEach(([queue, handler]) => {
      channel.consume(queue, (msg) => {
        if (msg) {
          const log = JSON.parse(msg.content.toString());
          handler(log, msg.fields.routingKey);
          channel.ack(msg);
        }
      });
    });

    return { connection, channel };
  }

  async publishLog(channel, routingKey, message, level = 'info') {
    const logEntry = {
      message,
      level,
      timestamp: new Date().toISOString(),
      source: routingKey
    };

    await channel.publish('application_logs', routingKey, 
      Buffer.from(JSON.stringify(logEntry)));
    
    console.log(`📝 Log published: ${routingKey} - ${message}`);
  }
}

// Usage with pattern examples
async function runTopicDemo() {
  const demo = new TopicExchangeDemo();
  const { connection, channel } = await demo.setupLoggingSystem();

  // Test different routing patterns
  const logScenarios = [
    { key: 'europe.critical.payment', msg: 'Payment service down in London' },
    { key: 'usa.info.database', msg: 'Database backup completed' },
    { key: 'app.performance.frontend', msg: 'Frontend response time increased' },
    { key: 'asia.critical.database', msg: 'DB connection pool exhausted' }
  ];

  for (const { key, msg } of logScenarios) {
    await demo.publishLog(channel, key, msg);
    await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for demo
  }
}
```

### Pattern Matching Examples

```javascript
// Pattern: "*.critical.*"
'europe.critical.payment'    // ✅ Match
'usa.critical.database'      // ✅ Match
'app.critical.frontend.auth' // ❌ No match (too many words)

// Pattern: "europe.*.*"
'europe.info.payment'        // ✅ Match
'europe.critical.database'   // ✅ Match
'usa.info.payment'           // ❌ No match (wrong region)

// Pattern: "app.#"
'app.performance'            // ✅ Match
'app.error.auth.login'       // ✅ Match
'system.app.error'           // ❌ No match (doesn't start with app)
```

---

## Headers Exchange

**Perfect for**: Complex business logic, multi-criteria routing, legacy integration

### How It Works
Routes based on **message header attributes** using `x-match`:
- `all` = ALL headers must match
- `any` = ANY header can match

```javascript
class HeadersExchangeDemo {
  async setupSmartRouting() {
    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();

    // Create headers exchange
    await channel.assertExchange('smart_order_routing', 'headers', { durable: true });

    // Define routing rules
    const routingRules = [
      {
        queue: 'vip_processing',
        headers: { 'x-match': 'all', 'customer_type': 'vip', 'priority': 'high' }
      },
      {
        queue: 'europe_processing',
        headers: { 'x-match': 'any', 'region': 'europe', 'country': 'germany' }
      },
      {
        queue: 'express_shipping',
        headers: { 'x-match': 'any', 'shipping': 'express', 'customer_type': 'vip' }
      },
      {
        queue: 'electronics_dept',
        headers: { 'x-match': 'all', 'category': 'electronics' }
      }
    ];

    // Setup queues and bindings
    for (const rule of routingRules) {
      await channel.assertQueue(rule.queue, { durable: true });
      await channel.bindQueue(rule.queue, 'smart_order_routing', '', rule.headers);
    }

    // Setup consumers
    routingRules.forEach(rule => {
      channel.consume(rule.queue, (msg) => {
        if (msg) {
          const order = JSON.parse(msg.content.toString());
          console.log(`🎯 ${rule.queue.toUpperCase()}: Order ${order.id}`);
          console.log(`   Headers: ${JSON.stringify(msg.properties.headers)}`);
          channel.ack(msg);
        }
      });
    });

    return { connection, channel };
  }

  async publishOrderWithHeaders(channel, order, headers) {
    await channel.publish('smart_order_routing', '', 
      Buffer.from(JSON.stringify(order)),
      { headers }
    );
    
    console.log(`📦 Order published: ${order.id} with headers:`, headers);
  }
}

// Usage
async function runHeadersDemo() {
  const demo = new HeadersExchangeDemo();
  const { connection, channel } = await demo.setupSmartRouting();

  // Test different header combinations
  const orderScenarios = [
    {
      order: { id: 'ORD-001', product: 'iPhone 15 Pro' },
      headers: {
        customer_type: 'vip',
        priority: 'high',
        category: 'electronics',
        region: 'usa'
      }
    },
    {
      order: { id: 'ORD-002', product: 'Book: Node.js Guide' },
      headers: {
        customer_type: 'regular',
        priority: 'normal',
        category: 'books',
        region: 'europe',
        country: 'germany'
      }
    },
    {
      order: { id: 'ORD-003', product: 'Gaming Laptop' },
      headers: {
        customer_type: 'business',
        category: 'electronics',
        shipping: 'express'
      }
    }
  ];

  for (const { order, headers } of orderScenarios) {
    await demo.publishOrderWithHeaders(channel, order, headers);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}
```

---

## Priority Queues

**Perfect for**: Critical alerts, SLA-based processing, emergency handling

### Priority Levels Strategy

```javascript
const PRIORITIES = {
  SYSTEM_CRITICAL: 10,  // System failures, security alerts
  USER_CRITICAL: 8,     // Payment failures, account issues  
  USER_URGENT: 6,       // Password resets, urgent requests
  NORMAL: 4,            // Regular user operations
  BACKGROUND: 2,        // Analytics, cleanup tasks
  BATCH: 1              // Bulk operations, reports
};
```

### Implementation

```javascript
class PriorityQueueManager {
  async setupPriorityQueue(queueName, maxPriority = 10) {
    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();

    // CRITICAL: Enable priority support
    await channel.assertQueue(queueName, {
      durable: true,
      arguments: { 'x-max-priority': maxPriority }
    });

    // CRITICAL: Set prefetch to 1 for strict priority ordering
    await channel.prefetch(1);

    return { connection, channel };
  }

  async publishPriorityMessage(channel, queueName, message, priority) {
    await channel.sendToQueue(queueName, 
      Buffer.from(JSON.stringify(message)), 
      { 
        priority: priority,
        persistent: true 
      }
    );
    console.log(`📤 Priority ${priority}: ${message.task}`);
  }

  async consumePriorityMessages(channel, queueName) {
    await channel.consume(queueName, (msg) => {
      if (msg) {
        const message = JSON.parse(msg.content.toString());
        const priority = msg.properties.priority || 0;
        
        console.log(`📥 Processing priority ${priority}: ${message.task}`);
        
        // Route based on priority
        this.handleByPriority(message, priority);
        
        channel.ack(msg);
      }
    });
  }

  handleByPriority(message, priority) {
    if (priority >= 9) {
      console.log('🚨 CRITICAL - Immediate processing required');
    } else if (priority >= 6) {
      console.log('⚡ HIGH - Fast track processing');
    } else if (priority >= 3) {
      console.log('📋 NORMAL - Standard processing');
    } else {
      console.log('🔄 LOW - Background processing');
    }
  }
}

// Usage
async function runPriorityDemo() {
  const manager = new PriorityQueueManager();
  const { connection, channel } = await manager.setupPriorityQueue('priority_tasks');

  // Setup consumer
  await manager.consumePriorityMessages(channel, 'priority_tasks');

  // Publish messages in random order (RabbitMQ will sort by priority)
  const tasks = [
    { task: 'Generate monthly report', priority: PRIORITIES.BATCH },
    { task: 'System security alert', priority: PRIORITIES.SYSTEM_CRITICAL },
    { task: 'Process user registration', priority: PRIORITIES.NORMAL },
    { task: 'Payment failed notification', priority: PRIORITIES.USER_CRITICAL },
    { task: 'Password reset request', priority: PRIORITIES.USER_URGENT }
  ];

  // Publish in random order
  for (const { task, priority } of tasks.sort(() => Math.random() - 0.5)) {
    await manager.publishPriorityMessage(channel, 'priority_tasks', { task }, priority);
  }
}
```

---

## Error Handling & Dead Letter Queues

### Robust Error Handling Pattern

```javascript
class RobustMessageHandler {
  async setupWithDLQ() {
    const connection = await amqp.connect('amqp://localhost');
    const channel = await connection.createChannel();

    // Dead Letter Exchange
    await channel.assertExchange('dlx', 'direct', { durable: true });
    await channel.assertQueue('failed_messages', { durable: true });
    await channel.bindQueue('failed_messages', 'dlx', 'failed');

    // Main queue with DLQ configuration
    await channel.assertQueue('main_processing', {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': 'dlx',
        'x-dead-letter-routing-key': 'failed',
        'x-message-ttl': 300000,  // 5 minutes TTL
        'x-max-retries': 3
      }
    });

    return { connection, channel };
  }

  async processWithRetry(channel, queueName) {
    await channel.consume(queueName, async (msg) => {
      if (msg) {
        try {
          const message = JSON.parse(msg.content.toString());
          
          // Simulate processing that might fail
          await this.processMessage(message);
          
          console.log('✅ Message processed successfully');
          channel.ack(msg);
          
        } catch (error) {
          const retryCount = (msg.properties.headers['x-retry-count'] || 0) + 1;
          
          if (retryCount <= 3) {
            console.log(`⚠️ Processing failed, retry ${retryCount}/3`);
            
            // Republish with retry count
            await channel.publish('', queueName,
              msg.content,
              {
                ...msg.properties,
                headers: {
                  ...msg.properties.headers,
                  'x-retry-count': retryCount
                }
              }
            );
            
            channel.ack(msg);
          } else {
            console.log('❌ Max retries exceeded, sending to DLQ');
            channel.nack(msg, false, false); // Send to DLQ
          }
        }
      }
    });
  }

  async processMessage(message) {
    // Simulate processing that might fail
    if (Math.random() < 0.3) {
      throw new Error('Simulated processing error');
    }
    
    console.log('Processing:', message.task);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}
```

---

## High Availability

### Basic HA Setup

```javascript
class HAConnection {
  constructor(nodes) {
    this.nodes = nodes;
    this.currentIndex = 0;
    this.connection = null;
    this.channel = null;
  }

  async connect() {
    for (let attempt = 0; attempt < this.nodes.length; attempt++) {
      try {
        const nodeUrl = this.nodes[this.currentIndex];
        console.log(`🔄 Connecting to ${nodeUrl}...`);
        
        this.connection = await amqp.connect(nodeUrl);
        this.channel = await this.connection.createChannel();
        
        // Setup error handlers
        this.connection.on('error', (err) => {
          console.error('Connection error:', err.message);
          this.handleConnectionError();
        });
        
        console.log(`✅ Connected to ${nodeUrl}`);
        return this.channel;
        
      } catch (error) {
        console.error(`❌ Failed to connect to ${this.nodes[this.currentIndex]}`);
        this.currentIndex = (this.currentIndex + 1) % this.nodes.length;
      }
    }
    
    throw new Error('All RabbitMQ nodes unavailable');
  }

  async handleConnectionError() {
    console.log('🔄 Attempting to reconnect...');
    setTimeout(() => {
      this.connect().catch(console.error);
    }, 5000);
  }

  async publish(exchange, routingKey, message) {
    if (!this.channel) {
      await this.connect();
    }

    try {
      await this.channel.publish(exchange, routingKey, 
        Buffer.from(JSON.stringify(message)),
        { persistent: true }
      );
      return true;
    } catch (error) {
      console.error('Publish failed:', error.message);
      await this.handleConnectionError();
      throw error;
    }
  }
}

// Usage
const haConnection = new HAConnection([
  'amqp://node1.example.com',
  'amqp://node2.example.com',
  'amqp://node3.example.com'
]);
```

---

## Monitoring & Health Checks

### Health Monitoring System

```javascript
const axios = require('axios');

class RabbitMQMonitor {
  constructor(managementUrl, credentials) {
    this.managementUrl = managementUrl;
    this.auth = credentials;
  }

  async checkClusterHealth() {
    try {
      // Check node status
      const nodes = await this.getNodes();
      const healthyNodes = nodes.filter(n => n.running);
      
      // Check queue status
      const queues = await this.getQueues();
      const unhealthyQueues = queues.filter(q => 
        q.messages > 10000 || q.memory > 100000000
      );

      const health = {
        status: healthyNodes.length >= Math.ceil(nodes.length / 2) ? 'healthy' : 'degraded',
        nodes: {
          total: nodes.length,
          healthy: healthyNodes.length,
          unhealthy: nodes.length - healthyNodes.length
        },
        queues: {
          total: queues.length,
          unhealthy: unhealthyQueues.length
        },
        timestamp: new Date().toISOString()
      };

      console.log('🏥 Cluster Health:', health);
      return health;
      
    } catch (error) {
      console.error('❌ Health check failed:', error.message);
      return { status: 'error', error: error.message };
    }
  }

  async getNodes() {
    const response = await axios.get(`${this.managementUrl}/api/nodes`, {
      auth: this.auth
    });
    return response.data;
  }

  async getQueues() {
    const response = await axios.get(`${this.managementUrl}/api/queues`, {
      auth: this.auth
    });
    return response.data;
  }

  startMonitoring(intervalMs = 30000) {
    setInterval(() => {
      this.checkClusterHealth();
    }, intervalMs);
  }
}

// Usage
const monitor = new RabbitMQMonitor('http://localhost:15672', {
  username: 'admin',
  password: 'password'
});

monitor.startMonitoring();
```

---

## Best Practices

### ✅ Do's

```javascript
// ✅ Always use durable queues for important messages
await channel.assertQueue('important_tasks', { 
  durable: true 
});

// ✅ Use persistent messages for reliability
await channel.publish(exchange, key, message, { 
  persistent: true 
});

// ✅ Always acknowledge messages after processing
channel.consume('queue', (msg) => {
  processMessage(msg);
  channel.ack(msg); // Important!
});

// ✅ Use prefetch for flow control
await channel.prefetch(1);

// ✅ Handle connection errors gracefully
connection.on('error', handleError);
connection.on('close', reconnect);
```

### ❌ Don'ts

```javascript
// ❌ Don't ignore errors
channel.consume('queue', (msg) => {
  try {
    processMessage(msg);
    channel.ack(msg);
  } catch (error) {
    // Don't just ignore errors!
    console.error(error);
    channel.nack(msg, false, false);
  }
});

// ❌ Don't forget to close connections
// Always close properly
await connection.close();

// ❌ Don't use high prefetch with priority queues
await channel.prefetch(100); // Breaks priority ordering!
```

### Configuration Checklist

- [ ] **Queues**: Set durable: true for persistence
- [ ] **Messages**: Use persistent: true for reliability  
- [ ] **Connections**: Implement reconnection logic
- [ ] **Errors**: Handle with DLQ and retry logic
- [ ] **Monitoring**: Set up health checks
- [ ] **Security**: Use authentication and SSL
- [ ] **Performance**: Tune prefetch settings
- [ ] **Clustering**: Configure for high availability

---

## Quick Reference

### Common Patterns

```javascript
// Simple Producer
await channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(data)));

// Simple Consumer  
await channel.consume(queue, (msg) => {
  if (msg) {
    const data = JSON.parse(msg.content.toString());
    processData(data);
    channel.ack(msg);
  }
});

// Priority Message
await channel.sendToQueue(queue, Buffer.from(JSON.stringify(data)), {
  priority: 5,
  persistent: true
});

// Dead Letter Queue Setup
await channel.assertQueue('main', {
  arguments: {
    'x-dead-letter-exchange': 'dlx',
    'x-dead-letter-routing-key': 'failed'
  }
});
```

### Exchange Types Quick Guide

| Need | Use |
|------|-----|
| Simple routing | Direct |
| Broadcast | Fanout |  
| Pattern matching | Topic |
| Complex rules | Headers |

---

## Conclusion

RabbitMQ provides powerful messaging capabilities for building resilient, scalable applications. Key takeaways:

1. **Choose the right exchange type** for your routing needs
2. **Design for reliability** with persistence and acknowledgments  
3. **Plan for scale** with clustering and load balancing
4. **Monitor actively** to catch issues early
5. **Handle errors gracefully** with retry logic and DLQs

Start with simple patterns and gradually add complexity as your needs grow. The examples in this guide provide a solid foundation for production-ready RabbitMQ implementations.

### Next Steps

1. **Practice**: Run the code examples locally
2. **Experiment**: Try different exchange types with your use cases
3. **Scale**: Implement clustering for production environments
4. **Monitor**: Set up comprehensive health monitoring
5. **Optimize**: Profile and tune performance for your workload

### Production Deployment Example

```javascript
// production-ready-setup.js
const amqp = require('amqplib');

class ProductionRabbitMQ {
  constructor(config) {
    this.config = {
      urls: config.urls || ['amqp://localhost'],
      exchange: config.exchange || 'production_app',
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 5000,
      heartbeat: config.heartbeat || 60,
      ...config
    };
    
    this.connection = null;
    this.channel = null;
    this.isConnected = false;
  }

  async connect() {
    for (const url of this.config.urls) {
      try {
        this.connection = await amqp.connect(url, {
          heartbeat: this.config.heartbeat
        });
        
        this.channel = await this.connection.createChannel();
        this.isConnected = true;
        
        // Setup error handlers
        this.connection.on('error', this.handleConnectionError.bind(this));
        this.connection.on('close', this.handleConnectionClose.bind(this));
        
        // Setup exchanges and queues
        await this.setupInfrastructure();
        
        console.log(`✅ Connected to RabbitMQ: ${url}`);
        return;
        
      } catch (error) {
        console.warn(`⚠️ Failed to connect to ${url}: ${error.message}`);
      }
    }
    
    throw new Error('❌ Could not connect to any RabbitMQ node');
  }

  async setupInfrastructure() {
    // Main application exchange
    await this.channel.assertExchange(this.config.exchange, 'topic', { 
      durable: true 
    });
    
    // Dead letter exchange
    await this.channel.assertExchange('dlx', 'direct', { 
      durable: true 
    });
    
    // Failed messages queue
    await this.channel.assertQueue('failed_messages', { 
      durable: true 
    });
    
    await this.channel.bindQueue('failed_messages', 'dlx', 'failed');
    
    // Application queues with DLQ support
    const queues = [
      'user_notifications',
      'order_processing', 
      'payment_processing',
      'analytics_events'
    ];
    
    for (const queueName of queues) {
      await this.channel.assertQueue(queueName, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'dlx',
          'x-dead-letter-routing-key': 'failed',
          'x-message-ttl': 3600000 // 1 hour TTL
        }
      });
    }
    
    console.log('🏗️ Infrastructure setup complete');
  }

  async publish(routingKey, message, options = {}) {
    if (!this.isConnected) {
      throw new Error('Not connected to RabbitMQ');
    }

    const messageOptions = {
      persistent: true,
      timestamp: Date.now(),
      messageId: this.generateMessageId(),
      ...options
    };

    try {
      const success = await this.channel.publish(
        this.config.exchange,
        routingKey,
        Buffer.from(JSON.stringify(message)),
        messageOptions
      );
      
      if (!success) {
        throw new Error('Publish returned false - channel flow control');
      }
      
      return messageOptions.messageId;
      
    } catch (error) {
      console.error('❌ Publish failed:', error.message);
      throw error;
    }
  }

  async consume(queueName, handler, options = {}) {
    if (!this.isConnected) {
      throw new Error('Not connected to RabbitMQ');
    }

    await this.channel.prefetch(options.prefetch || 1);
    
    await this.channel.consume(queueName, async (msg) => {
      if (msg) {
        try {
          const message = JSON.parse(msg.content.toString());
          await handler(message, msg);
          this.channel.ack(msg);
          
        } catch (error) {
          console.error(`❌ Message processing failed: ${error.message}`);
          
          const retryCount = this.getRetryCount(msg);
          if (retryCount < this.config.retryAttempts) {
            // Retry with delay
            setTimeout(() => {
              this.retryMessage(msg, retryCount + 1);
            }, this.config.retryDelay * Math.pow(2, retryCount)); // Exponential backoff
          } else {
            // Send to DLQ
            this.channel.nack(msg, false, false);
          }
        }
      }
    }, { noAck: false, ...options });
    
    console.log(`👂 Started consuming from ${queueName}`);
  }

  async retryMessage(originalMsg, retryCount) {
    const headers = {
      ...originalMsg.properties.headers,
      'x-retry-count': retryCount,
      'x-first-death-queue': originalMsg.fields.routingKey
    };

    await this.channel.publish(
      this.config.exchange,
      originalMsg.fields.routingKey,
      originalMsg.content,
      { ...originalMsg.properties, headers }
    );
    
    this.channel.ack(originalMsg);
  }

  getRetryCount(msg) {
    return msg.properties.headers?.['x-retry-count'] || 0;
  }

  generateMessageId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  handleConnectionError(error) {
    console.error('🔥 RabbitMQ connection error:', error.message);
    this.isConnected = false;
    this.attemptReconnect();
  }

  handleConnectionClose() {
    console.warn('⚠️ RabbitMQ connection closed');
    this.isConnected = false;
    this.attemptReconnect();
  }

  async attemptReconnect() {
    if (this.isConnected) return;
    
    console.log('🔄 Attempting to reconnect...');
    
    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('❌ Reconnection failed:', error.message);
        this.attemptReconnect();
      }
    }, this.config.retryDelay);
  }

  async close() {
    if (this.connection) {
      await this.connection.close();
      this.isConnected = false;
      console.log('👋 RabbitMQ connection closed');
    }
  }

  async getStats() {
    if (!this.isConnected) return null;
    
    try {
      // This would typically use the management API
      return {
        connected: this.isConnected,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Failed to get stats:', error.message);
      return null;
    }
  }
}

// Usage Example
async function productionExample() {
  const rabbit = new ProductionRabbitMQ({
    urls: [
      'amqp://user:pass@rabbit-1.example.com',
      'amqp://user:pass@rabbit-2.example.com', 
      'amqp://user:pass@rabbit-3.example.com'
    ],
    exchange: 'myapp_production',
    retryAttempts: 3,
    retryDelay: 2000
  });

  try {
    // Connect
    await rabbit.connect();
    
    // Setup consumers
    await rabbit.consume('user_notifications', async (message, msg) => {
      console.log('📧 Processing notification:', message);
      // Process notification logic here
      await sendEmail(message.email, message.subject, message.body);
    });

    await rabbit.consume('order_processing', async (message, msg) => {
      console.log('📦 Processing order:', message);
      // Process order logic here
      await processOrder(message.orderId);
    });

    // Publish messages
    await rabbit.publish('notifications.email', {
      email: 'user@example.com',
      subject: 'Order Confirmation',
      body: 'Your order has been confirmed!'
    });

    await rabbit.publish('orders.new', {
      orderId: 'ORD-12345',
      customerId: 'CUST-67890',
      items: [{ sku: 'ITEM-001', quantity: 2 }]
    });

    console.log('🚀 Production system running...');
    
  } catch (error) {
    console.error('💥 Production setup failed:', error);
    process.exit(1);
  }
}

// Helper functions (implement according to your needs)
async function sendEmail(email, subject, body) {
  // Email sending logic
  console.log(`📧 Sending email to ${email}: ${subject}`);
}

async function processOrder(orderId) {
  // Order processing logic
  console.log(`📦 Processing order: ${orderId}`);
}

// Start the production system
if (require.main === module) {
  productionExample().catch(console.error);
}

module.exports = ProductionRabbitMQ;
```

### Kubernetes Deployment

```yaml
# rabbitmq-deployment.yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: rabbitmq
spec:
  serviceName: rabbitmq
  replicas: 3
  selector:
    matchLabels:
      app: rabbitmq
  template:
    metadata:
      labels:
        app: rabbitmq
    spec:
      containers:
      - name: rabbitmq
        image: rabbitmq:3.12-management
        ports:
        - containerPort: 5672
        - containerPort: 15672
        env:
        - name: RABBITMQ_ERLANG_COOKIE
          value: "your-secret-cookie"
        - name: RABBITMQ_DEFAULT_USER
          value: "admin"
        - name: RABBITMQ_DEFAULT_PASS
          value: "secure-password"
        volumeMounts:
        - name: rabbitmq-data
          mountPath: /var/lib/rabbitmq
        - name: rabbitmq-config
          mountPath: /etc/rabbitmq
      volumes:
      - name: rabbitmq-config
        configMap:
          name: rabbitmq-config
  volumeClaimTemplates:
  - metadata:
      name: rabbitmq-data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 10Gi

---
apiVersion: v1
kind: Service
metadata:
  name: rabbitmq
spec:
  ports:
  - port: 5672
    targetPort: 5672
    name: amqp
  - port: 15672
    targetPort: 15672
    name: management
  selector:
    app: rabbitmq

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: rabbitmq-config
data:
  rabbitmq.conf: |
    cluster_formation.peer_discovery_backend = rabbit_peer_discovery_k8s
    cluster_formation.k8s.host = kubernetes.default.svc.cluster.local
    cluster_formation.k8s.address_type = hostname
    cluster_formation.k8s.service_name = rabbitmq
    cluster_partition_handling = pause_minority
    vm_memory_high_watermark.relative = 0.6
    disk_free_limit.relative = 2.0
```

### Performance Tuning Guide

```javascript
// performance-config.js
const performanceConfig = {
  // Connection tuning
  connection: {
    heartbeat: 60,
    frameMax: 131072,
    channelMax: 2047
  },

  // Channel settings
  channel: {
    prefetch: 1,           // For priority queues
    // prefetch: 10,       // For high throughput
    confirmMode: true      // Publisher confirms
  },

  // Queue arguments for different use cases
  queueArgs: {
    highThroughput: {
      'x-max-length': 100000,
      'x-overflow': 'drop-head'
    },
    
    criticalMessages: {
      'x-max-priority': 10,
      'x-message-ttl': 3600000,
      'x-dead-letter-exchange': 'dlx'
    },
    
    largeMessages: {
      'x-max-length-bytes': 1000000000, // 1GB
      'x-overflow': 'reject-publish'
    }
  },

  // Message properties
  messageProps: {
    reliable: {
      persistent: true,
      mandatory: true,
      deliveryMode: 2
    },
    
    fast: {
      persistent: false,
      deliveryMode: 1
    }
  }
};

module.exports = performanceConfig;
```

### Troubleshooting Checklist

| Issue | Symptoms | Solution |
|-------|----------|----------|
| **Messages not processing** | Consumers idle, queue growing | Check consumer connection, prefetch settings |
| **Memory alerts** | High memory usage, slow performance | Reduce message TTL, increase consumer count |
| **Connection drops** | Frequent disconnections | Check heartbeat settings, network stability |
| **Priority not working** | Messages out of order | Verify queue has `x-max-priority`, prefetch=1 |
| **DLQ messages** | Messages in failed queue | Check processing logic, retry configuration |
| **Split brain** | Cluster partition | Check network, configure `pause_minority` |

### Resources & Documentation

- **Official Docs**: [https://www.rabbitmq.com/documentation.html](https://www.rabbitmq.com/documentation.html)
- **Node.js Client**: [https://amqp-node.github.io/amqplib/](https://amqp-node.github.io/amqplib/)
- **Management UI**: `http://localhost:15672` (guest/guest)
- **Community**: [https://groups.google.com/forum/#!forum/rabbitmq-users](https://groups.google.com/forum/#!forum/rabbitmq-users)

