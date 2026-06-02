migrate(
  (app) => {
    try {
      const products = app.findRecordsByFilter('products', '1=1', '', 50, 0)
      const users = app.findRecordsByFilter('_pb_users_auth_', '1=1', '', 5, 0)
      if (products.length === 0 || users.length === 0) return

      const col = app.findCollectionByNameOrId('inventory_counts')

      // Check if seeded
      try {
        app.findFirstRecordByData('inventory_counts', 'user_id', users[0].id)
        return
      } catch (_) {}

      const now = new Date()

      const subtractDays = (days) => {
        const d = new Date(now)
        d.setDate(d.getDate() - days)
        return d.toISOString().replace('T', ' ').substring(0, 19) + 'Z'
      }

      products.forEach((p, idx) => {
        const user = users[idx % users.length]
        const previous = p.get('min_stock') || 10

        const isDiscrepant = idx % 3 === 0
        const counted = isDiscrepant ? previous - ((idx % 3) + 1) : previous

        const record = new Record(col)
        record.set('product_id', p.id)
        record.set('user_id', user.id)
        record.set('previous_quantity', previous)
        record.set('counted_quantity', counted > 0 ? counted : 0)

        const fakeDate = subtractDays(idx % 7)

        app.save(record)

        app
          .db()
          .newQuery('UPDATE inventory_counts SET created = {:d}, updated = {:d} WHERE id = {:id}')
          .bind({ d: fakeDate, id: record.id })
          .execute()
      })
    } catch (e) {
      console.log('Seed inventory_counts failed:', e.message)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('inventory_counts')
      app.truncateCollection(col)
    } catch (_) {}
  },
)
