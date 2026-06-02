migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'fabio.advogado@uol.com.br')
      return // already seeded
    } catch (_) {}

    const record = new Record(users)
    record.setEmail('fabio.advogado@uol.com.br')
    record.setPassword('Skip@Pass')
    record.setVerified(true)
    record.set('name', 'Admin')
    record.set('role', 'admin')
    record.set('active', true)
    app.save(record)
  },
  (app) => {
    try {
      const record = app.findAuthRecordByEmail('_pb_users_auth_', 'fabio.advogado@uol.com.br')
      app.delete(record)
    } catch (_) {}
  },
)
