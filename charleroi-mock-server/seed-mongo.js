'use strict'

/**
 * Seeds the local MongoDB with a Charleroi supplier document required by
 * the get-availability handler (parking.suppliers collection).
 *
 * Run once:
 *   node seed-mongo.js
 *   # or with a custom URI:
 *   MONGO_URI=mongodb://localhost:27017/parking node seed-mongo.js
 */

const { MongoClient } = require('mongodb')

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/parking'

const charleroiSupplier = {
  name: 'Charleroi',
  code: 'Charleroi',
  products: [],
  settings: [
    { key: 'isEnabled', value: true },
    { key: 'availabilityTimeoutInSeconds', value: 30 },
    { key: 'availabilityTTLInMinutes', value: 5 },
    { key: 'bookingTimeoutInSeconds', value: 60 },
    { key: 'maxAdvanceAvailabilityInDays', value: 365 },
    { key: 'maxDurationInDays', value: 30 }
  ]
}

async function seed () {
  const client = new MongoClient(MONGO_URI)
  try {
    await client.connect()
    console.log(`Connected to ${MONGO_URI}`)

    const db = client.db()
    const collection = db.collection('parking.suppliers')

    const existing = await collection.findOne({ code: 'Charleroi' })
    if (existing) {
      await collection.updateOne(
        { code: 'Charleroi' },
        { $set: charleroiSupplier }
      )
      console.log('Updated existing Charleroi supplier document')
    } else {
      await collection.insertOne(charleroiSupplier)
      console.log('Inserted Charleroi supplier document')
    }

    const doc = await collection.findOne({ code: 'Charleroi' })
    console.log('Supplier document:', JSON.stringify(doc, null, 2))
  } finally {
    await client.close()
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
