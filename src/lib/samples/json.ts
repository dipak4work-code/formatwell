/** A realistic ~50-line API response used by the JSON tool's "Sample" button. */
export const JSON_SAMPLE = `{
  "meta": {
    "requestId": "b1f2c3d4-5678-90ab-cdef-1234567890ab",
    "timestamp": "2026-07-13T09:24:11Z",
    "version": "2.1.0",
    "durationMs": 42
  },
  "pagination": {
    "page": 1,
    "pageSize": 3,
    "totalItems": 128,
    "totalPages": 43,
    "hasNext": true
  },
  "data": [
    {
      "id": 4821,
      "type": "order",
      "customer": { "id": 17, "name": "Ada Lovelace", "vip": true },
      "items": [
        { "sku": "KB-88", "qty": 1, "price": 129.99 },
        { "sku": "MS-02", "qty": 2, "price": 24.5 }
      ],
      "total": 178.99,
      "currency": "USD",
      "status": "shipped",
      "notes": null
    },
    {
      "id": 4822,
      "type": "order",
      "customer": { "id": 42, "name": "Alan Turing", "vip": false },
      "items": [
        { "sku": "HD-1T", "qty": 1, "price": 89.0 }
      ],
      "total": 89.0,
      "currency": "USD",
      "status": "processing",
      "notes": "Gift wrap requested"
    },
    {
      "id": 4823,
      "type": "refund",
      "customer": { "id": 17, "name": "Ada Lovelace", "vip": true },
      "items": [],
      "total": -24.5,
      "currency": "USD",
      "status": "completed",
      "notes": "Returned MS-02"
    }
  ],
  "links": {
    "self": "/api/orders?page=1",
    "next": "/api/orders?page=2"
  }
}`;
