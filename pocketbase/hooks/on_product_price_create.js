onRecordAfterCreateSuccess((e) => {
  const price = e.record.get('price')
  if (price === null || price === undefined || price === '') return e.next()

  try {
    const historyCol = $app.findCollectionByNameOrId('product_price_history')
    const record = new Record(historyCol)
    record.set('product_id', e.record.id)
    record.set('price', price)
    $app.save(record)
  } catch (err) {
    console.log('Failed to create price history for product ' + e.record.id, err.message)
  }
  return e.next()
}, 'products')
