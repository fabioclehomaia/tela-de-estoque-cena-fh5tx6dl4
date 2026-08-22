// Garante que novos registros de usuários criados via backend/hooks/API tenham emailVisibility = true
onRecordCreate((e) => {
  e.record.set('emailVisibility', true)
  e.next()
}, 'users')
