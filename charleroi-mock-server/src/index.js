'use strict'

const express = require('express')
const app = express()
const PORT = process.env.PORT || 3000

app.use(express.text({ type: 'text/xml', limit: '1mb' }))
app.use(express.text({ type: 'application/xml', limit: '1mb' }))

// ─── Helpers ──────────────────────────────────────────────────────────────────

function soapEnvelope (body) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <soap:Body>
    ${body}
  </soap:Body>
</soap:Envelope>`
}

function detectOperation (xml) {
  if (!xml) return null
  const ops = [
    'Login',
    'SearchBooking',
    'RequestBookingWithLicensePlate',
    'ConfirmBooking',
    'GetOrder',
  ]
  for (const op of ops) {
    if (xml.includes(`<${op} `) || xml.includes(`<${op}>`)) return op
  }
  return null
}

function extract (xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`))
  return m ? m[1].trim() : ''
}

function guid () {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

// ─── Mock state ───────────────────────────────────────────────────────────────
// Stores active bookings keyed by orderId so GetOrder returns realistic data
const bookingStore = new Map()

// ─── /authentication.asmx ────────────────────────────────────────────────────
app.post('/authentication.asmx', (req, res) => {
  const xml = req.body || ''
  console.log('[auth] Login request received')

  const token = 'mock-token-' + guid()
  const body = `<LoginResponse xmlns="http://tempuri.org/">
      <LoginResult>${token}</LoginResult>
    </LoginResponse>`

  res.set('Content-Type', 'text/xml; charset=utf-8')
  res.send(soapEnvelope(body))
})

// ─── /booking.asmx ───────────────────────────────────────────────────────────
app.post('/booking.asmx', (req, res) => {
  const xml = req.body || ''
  const op = detectOperation(xml)
  console.log(`[booking] Operation: ${op}`)

  res.set('Content-Type', 'text/xml; charset=utf-8')

  if (op === 'SearchBooking') {
    return res.send(handleSearchBooking(xml))
  }
  if (op === 'RequestBookingWithLicensePlate') {
    return res.send(handleRequestBookingWithLicensePlate(xml))
  }
  if (op === 'ConfirmBooking') {
    return res.send(handleConfirmBooking(xml))
  }
  if (op === 'GetOrder') {
    return res.send(handleGetOrder(xml))
  }

  console.warn('[booking] Unknown operation:', op)
  res.status(400).send('<error>Unknown SOAP operation</error>')
})

// ─── SearchBooking ────────────────────────────────────────────────────────────
function handleSearchBooking (xml) {
  const body = `<SearchBookingResponse xmlns="http://tempuri.org/">
      <SearchBookingResult>
        <Parking>
          <ItemId>7</ItemId>
          <ItemLabel>Lock - Parking sécurisé</ItemLabel>
          <ItemDescription>Parking sécurisé — zone couverte</ItemDescription>
          <GlobalAmount>112.75</GlobalAmount>
          <DayAmount>16.11</DayAmount>
          <CarPlaceAvailable>42</CarPlaceAvailable>
        </Parking>
        <Parking>
          <ItemId>45</ItemId>
          <ItemLabel>Outdoor Parking</ItemLabel>
          <ItemDescription>Parking extérieur longue durée</ItemDescription>
          <GlobalAmount>89.50</GlobalAmount>
          <DayAmount>12.79</DayAmount>
          <CarPlaceAvailable>120</CarPlaceAvailable>
        </Parking>
        <Parking>
          <ItemId>12</ItemId>
          <ItemLabel>VIP Parking</ItemLabel>
          <ItemDescription>Parking VIP avec navette</ItemDescription>
          <GlobalAmount>199.00</GlobalAmount>
          <DayAmount>28.43</DayAmount>
          <CarPlaceAvailable>8</CarPlaceAvailable>
        </Parking>
      </SearchBookingResult>
    </SearchBookingResponse>`
  return soapEnvelope(body)
}

// ─── RequestBookingWithLicensePlate (make-booking AND amend-booking) ──────────
function handleRequestBookingWithLicensePlate (xml) {
  const orderId = extract(xml, 'orderId')
  const bookingId = extract(xml, 'bookingId')
  const itemId = extract(xml, 'itemID')
  const dateFrom = extract(xml, 'dateFrom')
  const dateTo = extract(xml, 'dateTo')
  const customerRef = extract(xml, 'customerReference')
  const firstName = extract(xml, 'customerFirstName')
  const lastName = extract(xml, 'customerLastName')
  const licensePlate = extract(xml, 'licensePlate')

  const isAmend = !!orderId && !!bookingId
  const newOrderId = guid()
  const newBookingId = String(80000 + Math.floor(Math.random() * 9999))

  if (isAmend) {
    // Amendment: cancel old booking, create new one
    const oldBookingId = bookingId
    const updateBookingId = newBookingId

    // Store old order — GetOrder(originalOrderId) returns CANCEL + OrderIdUpdate/BookingIdUpdate
    bookingStore.set(orderId, {
      orderId,
      bookingId: oldBookingId,
      newOrderId,
      newBookingId: updateBookingId,
      itemId,
      dateFrom,
      dateTo,
      customerRef,
      firstName,
      lastName,
      licensePlate,
      isAmend: true
    })

    // Store new order — GetOrder(newOrderId) returns CONFIRMED with CB2D
    bookingStore.set(newOrderId, {
      orderId: newOrderId,
      bookingId: updateBookingId,
      itemId,
      dateFrom,
      dateTo,
      customerRef,
      firstName,
      lastName,
      licensePlate,
      isAmend: false
    })

    console.log(`[amend] old orderId=${orderId} → new orderId=${newOrderId}, newBookingId=${updateBookingId}`)
  } else {
    // Fresh make-booking
    bookingStore.set(newOrderId, {
      orderId: newOrderId,
      bookingId: newBookingId,
      itemId,
      dateFrom,
      dateTo,
      customerRef,
      firstName,
      lastName,
      licensePlate,
      isAmend: false
    })
    console.log(`[make] new orderId=${newOrderId}, bookingId=${newBookingId}`)
  }

  const body = `<RequestBookingWithLicensePlateResponse xmlns="http://tempuri.org/">
      <RequestBookingWithLicensePlateResult>${isAmend ? orderId : newOrderId}</RequestBookingWithLicensePlateResult>
    </RequestBookingWithLicensePlateResponse>`
  return soapEnvelope(body)
}

// ─── ConfirmBooking ───────────────────────────────────────────────────────────
function handleConfirmBooking (xml) {
  const orderID = extract(xml, 'orderID')
  console.log(`[confirm] orderID=${orderID}`)

  const body = `<ConfirmBookingResponse xmlns="http://tempuri.org/">
      <ConfirmBookingResult>true</ConfirmBookingResult>
    </ConfirmBookingResponse>`
  return soapEnvelope(body)
}

// ─── GetOrder ─────────────────────────────────────────────────────────────────
function handleGetOrder (xml) {
  const orderID = extract(xml, 'orderID')
  console.log(`[getOrder] orderID=${orderID}`)

  const stored = bookingStore.get(orderID)

  if (!stored) {
    console.warn(`[getOrder] No booking found for orderId=${orderID}`)
    const body = `<GetOrderResponse xmlns="http://tempuri.org/">
        <GetOrderResult>
          <OrderDate>${new Date().toISOString()}</OrderDate>
          <OrderId>${orderID}</OrderId>
          <OrderNumber>C0000000</OrderNumber>
          <OrderPDF></OrderPDF>
          <OrderStatus />
          <OrderLineList>
            <OrderLine>
              <AccessCode />
              <BookingAmount>0.00</BookingAmount>
              <BookingID>0</BookingID>
              <BookingNumber>RES0000000</BookingNumber>
              <BookingStatus>UNKNOWN</BookingStatus>
              <CB2D />
              <CancelAmount>0.00</CancelAmount>
              <CancelDate />
              <CommissionAmount>0.00</CommissionAmount>
              <CommissionPercent>0.00</CommissionPercent>
              <CustomerReference></CustomerReference>
              <CustomerLastName></CustomerLastName>
              <CustomerPhone />
              <CustomerEmail />
              <CustomerFirstName></CustomerFirstName>
              <DateFrom></DateFrom>
              <DateTo></DateTo>
              <ItemLabel></ItemLabel>
              <Vatrate>20.00</Vatrate>
              <UpdateAllowed>0</UpdateAllowed>
              <OrderIdUpdate />
              <BookingIdUpdate />
              <LicensePlate />
              <UpdateRefundAmount>0.00</UpdateRefundAmount>
            </OrderLine>
          </OrderLineList>
        </GetOrderResult>
      </GetOrderResponse>`
    return soapEnvelope(body)
  }

  if (stored.isAmend) {
    // Return old (cancelled) booking line with OrderIdUpdate/BookingIdUpdate pointing to new
    const cb2d = 'CB2D-' + stored.newBookingId
    const body = `<GetOrderResponse xmlns="http://tempuri.org/">
        <GetOrderResult>
          <OrderDate>${new Date().toISOString()}</OrderDate>
          <OrderId>${stored.orderId}</OrderId>
          <OrderNumber>C${String(stored.bookingId).padStart(7, '0')}</OrderNumber>
          <OrderPDF>https://mock.charleroi-airport.com/reports/orderdocument.aspx?orderid=${stored.orderId.toUpperCase()}</OrderPDF>
          <OrderStatus />
          <OrderLineList>
            <OrderLine>
              <AccessCode />
              <BookingAmount>254.10</BookingAmount>
              <BookingID>${stored.bookingId}</BookingID>
              <BookingNumber>RES${String(stored.bookingId).padStart(7, '0')}</BookingNumber>
              <BookingStatus>CANCEL</BookingStatus>
              <CB2D />
              <CancelAmount>254.10</CancelAmount>
              <CancelDate>${new Date().toISOString()}</CancelDate>
              <CommissionAmount>0.00</CommissionAmount>
              <CommissionPercent>0.00</CommissionPercent>
              <CustomerReference>${stored.customerRef}</CustomerReference>
              <CustomerLastName>${stored.lastName}</CustomerLastName>
              <CustomerPhone />
              <CustomerEmail />
              <CustomerFirstName>${stored.firstName}</CustomerFirstName>
              <DateFrom>${stored.dateFrom}</DateFrom>
              <DateTo>${stored.dateTo}</DateTo>
              <ItemLabel>Mock Parking</ItemLabel>
              <Vatrate>20.00</Vatrate>
              <UpdateAllowed>0</UpdateAllowed>
              <OrderIdUpdate>${stored.newOrderId}</OrderIdUpdate>
              <BookingIdUpdate>${stored.newBookingId}</BookingIdUpdate>
              <LicensePlate>${stored.licensePlate}</LicensePlate>
              <UpdateRefundAmount>0.00</UpdateRefundAmount>
            </OrderLine>
          </OrderLineList>
        </GetOrderResult>
      </GetOrderResponse>`
    return soapEnvelope(body)
  }

  // Fresh make-booking: return confirmed line with CB2D
  const cb2d = 'CB2D-' + stored.bookingId
  const body = `<GetOrderResponse xmlns="http://tempuri.org/">
      <GetOrderResult>
        <OrderDate>${new Date().toISOString()}</OrderDate>
        <OrderId>${stored.orderId}</OrderId>
        <OrderNumber>C${String(stored.bookingId).padStart(7, '0')}</OrderNumber>
        <OrderPDF>https://mock.charleroi-airport.com/reports/orderdocument.aspx?orderid=${stored.orderId.toUpperCase()}</OrderPDF>
        <OrderStatus />
        <OrderLineList>
          <OrderLine>
            <AccessCode>ACC-${stored.bookingId}</AccessCode>
            <BookingAmount>89.50</BookingAmount>
            <BookingID>${stored.bookingId}</BookingID>
            <BookingNumber>RES${String(stored.bookingId).padStart(7, '0')}</BookingNumber>
            <BookingStatus>CONFIRMED</BookingStatus>
            <CB2D>${cb2d}</CB2D>
            <CancelAmount>0.00</CancelAmount>
            <CancelDate />
            <CommissionAmount>0.00</CommissionAmount>
            <CommissionPercent>0.00</CommissionPercent>
            <CustomerReference>${stored.customerRef}</CustomerReference>
            <CustomerLastName>${stored.lastName}</CustomerLastName>
            <CustomerPhone />
            <CustomerEmail />
            <CustomerFirstName>${stored.firstName}</CustomerFirstName>
            <DateFrom>${stored.dateFrom}</DateFrom>
            <DateTo>${stored.dateTo}</DateTo>
            <ItemLabel>Mock Parking</ItemLabel>
            <Vatrate>20.00</Vatrate>
            <UpdateAllowed>1</UpdateAllowed>
            <OrderIdUpdate />
            <BookingIdUpdate />
            <LicensePlate>${stored.licensePlate}</LicensePlate>
            <UpdateRefundAmount>0.00</UpdateRefundAmount>
          </OrderLine>
        </OrderLineList>
      </GetOrderResult>
    </GetOrderResponse>`
  return soapEnvelope(body)
}

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Charleroi SOAP mock server running on port ${PORT}`)
  console.log('Endpoints:')
  console.log('  POST /authentication.asmx  — Login')
  console.log('  POST /booking.asmx         — SearchBooking, RequestBookingWithLicensePlate, ConfirmBooking, GetOrder')
})
