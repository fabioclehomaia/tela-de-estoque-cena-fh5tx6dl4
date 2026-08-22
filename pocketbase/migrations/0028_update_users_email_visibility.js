migrate(
  (app) => {
    // Buscar todos os registros de users e atualizar emailVisibility = true via app.save
    const users = app.findRecordsByFilter('users', '', '', 0, 0)
    for (let i = 0; i < users.length; i++) {
      const user = users[i]
      user.set('emailVisibility', true)
      app.save(user)
    }
  },
  (app) => {
    const users = app.findRecordsByFilter('users', '', '', 0, 0)
    for (let i = 0; i < users.length; i++) {
      const user = users[i]
      user.set('emailVisibility', false)
      app.save(user)
    }
  },
)
