# Entity-Relationship Diagram

```mermaid
erDiagram
  users ||--o{ tickets : submits
  users ||--o{ payments : "receives (member)"
  users ||--o{ ticket_notes : authors
  users ||--o{ login_attempts : generates
  users ||--o{ otp_codes : holds
  users ||--o{ notifications : receives
  users ||--o{ audit_logs : "acts (actor)"
  users ||--o{ ledger_entries : "member of"

  trek_pricing ||--o{ tickets : "priced (snapshot)"
  tickets ||--o{ refunds : "cancelled into"
  tickets ||--o{ ticket_notes : annotated
  tickets ||--o{ ledger_entries : posts
  tickets ||--o{ replacement_tickets : "replaced by"
  payments ||--o{ ledger_entries : posts
  refunds  ||--o{ ledger_entries : posts

  users {
    uuid id PK
    text full_name
    citext email UK
    text password_hash
    user_role role
    bool is_active
    text totp_secret
    bool totp_enabled
    bool email_2fa
    bool login_alerts
    int  failed_otp_count
    timestamptz locked_until
    timestamptz last_login_at
  }
  trek_pricing {
    uuid id PK
    text name UK
    numeric permit_price
    bool is_active
  }
  tickets {
    uuid id PK
    text ticket_code UK
    uuid member_id FK
    uuid trek_id FK
    text trek_name
    citext booking_email
    date booking_date
    date trek_date
    int  persons
    numeric permit_price "snapshot"
    numeric commission_per_person
    numeric commission_amount
    ticket_status status
    jsonb flags
    text[] tags
    uuid verified_by FK
    timestamptz verified_at
  }
  payments {
    uuid id PK
    uuid member_id FK
    numeric amount
    date payment_date
    payment_method method
    text reference_number
    text receipt_no UK
  }
  refunds {
    uuid id PK
    uuid ticket_id FK
    date cancellation_date
    int  days_before_trek
    int  refund_percent
    numeric refund_amount
    date expected_refund_date
    refund_status status
    date received_date
  }
  ledger_entries {
    uuid id PK
    ledger_type type
    ledger_flow flow
    numeric amount
    uuid member_id FK
    uuid ticket_id FK
    uuid payment_id FK
    uuid refund_id FK
    text reference_number
    text notes
    timestamptz created_at "append-only"
  }
  replacement_tickets {
    uuid id PK
    uuid old_ticket_id FK
    text old_ticket_code
    text new_ticket_code
    date replacement_date
    int  persons
    numeric permit_cost
  }
  original_tickets {
    uuid id PK
    text ticket_code
    citext booking_email
    date booking_date
    date trek_date
    int persons
    numeric permit_price
  }
  ticket_notes {
    uuid id PK
    uuid ticket_id FK
    uuid author_id FK
    text body
  }
  notifications {
    uuid id PK
    uuid user_id FK
    text title
    text body
    bool is_read
  }
  audit_logs {
    uuid id PK
    uuid actor_id FK
    text action
    text entity
    text entity_id
    jsonb metadata
    inet ip_address
  }
  settings {
    text key PK
    jsonb value
  }
```

**Key invariants**
- `tickets.permit_price` is a **snapshot** — editing `trek_pricing` never mutates history.
- `ledger_entries` and `audit_logs` are **append-only** (the ledger enforces this with a DB trigger).
- `commission_amount` is kept consistent by a DB trigger (`persons × commission_per_person`).
