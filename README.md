## Los Quioscos (backend)

A distributed backend system built with **NestJS and TypeScript**, designed to manage the logistics and commerce of perishable goods between producers, kiosks, and transporters.

The platform is based on a **microservices architecture**, combining real-time communication, asynchronous event processing, and advanced document validation to support a scalable and secure marketplace.


#### System overview

The system handles the full lifecycle of a commerce platform:

* User identity, roles, and permissions
* Document validation with image processing and biometrics
* Inventory management with expiration-aware logic (FEFO)
* Order lifecycle with reservation-based consistency
* Contract-based recurring transactions

It is designed to support **real-world constraints** such as perishable inventory, asynchronous workflows, and regulatory validation.

<p align="center">
  <img src="./screenshots/image.png" width="100%" />
</p>

#### Engineering highlights

* Designed a **hybrid database architecture** (SQL + NoSQL) based on data access patterns
* Implemented **reservation-based stock control** to prevent overselling in concurrent scenarios
* Built a **document validation pipeline** combining CV techniques and domain rules
* Applied **event-driven architecture** using Kafka for decoupled workflows
* Modeled complex business logic such as **contracts with versioning and scheduling**

#### Architecture

| Component        | Description                                   |
| ---------------- | --------------------------------------------- |
| Architecture     | Microservices-based system                    |
| Communication    | gRPC (internal), REST (external APIs)         |
| Messaging        | Kafka for event-driven workflows              |
| Databases        | PostgreSQL (relational) + MongoDB (documents) |
| Containerization | Docker + docker-compose                       |
| Auth             | JWT + OAuth (Google)                          |


#### Core services

##### Users service

Manages authentication, authorization, and user lifecycle.

* JWT + OAuth login (Google)
* OTP verification via Twilio
* Role-Based Access Control (RBAC)
* Soft delete with data anonymization

##### Documents service

Handles identity validation using **image processing and OCR pipelines**.

* Multi-step validation: format, quality, structure, and logic
* Template-based document verification
* Face matching using embeddings (document vs selfie)
* gRPC-based binary file transfer for efficiency


#### Commerce service (core domain)

##### Inventory management (FEFO)

* Per-batch tracking with expiration dates
* FEFO (First Expire, First Out) dispatch strategy
* Full audit via stock movement logs

##### Orders and reservations

* Cart, Checkout, and Order pipeline
* Batch-level reservation system to prevent race conditions
* State-driven order lifecycle

##### Contracts (recurring orders)

* Versioned contract negotiation system
* Automated order generation via scheduling
* Rule-based cancellations and penalties


#### Security & data integrity

* Stateless authentication with JWT
* OAuth integration for external identity providers
* Role-based access control (RBAC)
* Strong consistency through reservation-based inventory handling
* Binary-safe communication via gRPC