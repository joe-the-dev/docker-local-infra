# Charleroi SOAP Mock Server

Mock SOAP server for local development/testing of the Charleroi parking API without VPN.

## Quick start

```bash
# 1. Build & run the mock server
docker build -t charleroi-mock:latest .
docker run -d --name charleroi-mock -p 3099:3000 charleroi-mock:latest

# 2. Seed MongoDB with the Charleroi supplier document (run once)
npm install mongodb --no-save
MONGO_URI=mongodb://localhost:27017/parking node seed-mongo.js

# 3. Point the parking service at the mock
# In int-gateway-parking/.env:
CHARLEROI_EXTERNAL_ENDPOINT=http://localhost:3099
CHARLEROI_EXTERNAL_CUSTOMER_ID=mock-customer
CHARLEROI_EXTERNAL_CUSTOMER_KEY=mock-key

# 4. Start the parking service and test
```

## Why the seed is needed

The get-availability handler looks up `parking.suppliers` in MongoDB to check
`isEnabled: true` before routing to the Charleroi handler. Without a supplier
document, the switch falls through and returns 0 products.

## Endpoints

| Path | Operations |
|---|---|
| `POST /authentication.asmx` | `Login` → returns mock token |
| `POST /booking.asmx` | `SearchBooking`, `RequestBookingWithLicensePlate`, `ConfirmBooking`, `GetOrder` |

## SearchBooking — items returned

| ItemId | Label | GlobalAmount (EUR) |
|---|---|---|
| 7 | Lock - Parking sécurisé | 112.75 |
| 45 | Outdoor Parking | 89.50 |
| 12 | VIP Parking | 199.00 |

## Flow behaviour

### Make-booking
- `RequestBookingWithLicensePlate` (no orderId/bookingId) → returns new orderId GUID
- `GetOrder(newOrderId)` → `BookingStatus: CONFIRMED`, `CB2D: CB2D-{bookingId}`

### Amend-booking
- `RequestBookingWithLicensePlate` (with orderId+bookingId) → echoes back original orderId
- `GetOrder(originalOrderId)` → `BookingStatus: CANCEL`, `OrderIdUpdate` / `BookingIdUpdate` as new booking refs

## Stop

```bash
docker stop charleroi-mock && docker rm charleroi-mock
```
