const config = require("./config.js");
const {

  default:
  IXConnect,
  areJidsSameUser,
  DisconnectReason,
  downloadContentFromMessage,
  fetchLatestBaileysVersion,
  generateForwardMessageContent,
  generateMessageID,
  generateWAMessageFromContent,
  jidDecode,
  makeInMemoryStore,
  PHONENUMBER_MCC,
  prepareWAMessageMedia,
  proto,
  useMultiFileAuthState,

} = require("@whiskeysockets/baileys");

const pino = require("pino");
const fs = require("fs");
const chalk = require("chalk");
const FileType = require("file-type");
const CFonts = require("cfonts");
const { exec, spawn, execSync } = require("child_process");
const moment = require("moment-timezone");
const PhoneNumber = require("awesome-phonenumber");
const { promisify } = require("util");
const writeFileAsync = promisify(fs.writeFile);
const path = require("path");
const readLine = require("readline");

const {
  imageToWebp,
  videoToWebp,
  writeExifImg,
  writeExifVid,
} = require("./lib/exif");
const {
  smsg,
  isUrl,
  generateMessageTag,
  getBuffer,
  getSizeMedia,
  fetchJson,
  await,
  sleep,
} = require("./lib/myfunc");
const figlet = require("figlet");
const { color } = require("./lib/color");


//-------------------------------------------------------------------------------------------------------------------------------------//


let phoneNumber = global.pairNumber;

module.exports = async function startIX() {
  try {
    const store = makeInMemoryStore({
      logger: pino().child({ level: "silent", stream: "store" }),
    });

    const authMode = global.auth;
    const qrMode = process.argv.includes('--use-qr-code') || auth.toLowerCase() === 'qr';
    const pairingMode = process.argv.includes('--use-pairing-code') || auth.toLowerCase() === 'pairing';

    const rl = readLine.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (text) => new Promise((resolve) => rl.question(text, resolve));

    const { state, saveCreds } = await useMultiFileAuthState(`${global.sessionFile}`);
    const IX = IXConnect({
      logger: pino({ level: "silent" }),
      printQRInTerminal: !pairingMode,
      browser: ["Ubuntu", "Safari", "3.1.0"],
      auth: state,
      patchMessageBeforeSending: (message) => {
        const requiresPatch = !!(
          message.buttonsMessage
          || message.templateMessage
          || message.listMessage
        );
        if (requiresPatch) {
          message = {
            viewOnceMessage: {
              message: {
                messageContextInfo: {
                  deviceListMetadataVersion: 2,
                  deviceListMetadata: {},
                },
                ...message,
              },
            },
          };
        }
        return message;
      },
    });

    store.bind(IX.ev);

    if (!phoneNumber) {
      console.log(chalk.bgBlack(chalk.redBright('Start with country code of your WhatsApp Number, Example : 916xxxx'), '\n> '));
      phoneNumber = await question(chalk.bgBlack(chalk.greenBright('Please enter your WhatsApp number example: 916xxxx'), '\n> '));
    }

    if (pairingMode && !IX.authState.creds.registered) {
      phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

      if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
        console.log(chalk.bgBlack(chalk.redBright('Start with country code of your WhatsApp Number, Example : 916xxxx'), '\n> '));
        process.exit(0);
      }

      setTimeout(async () => {
        let code = await IX.requestPairingCode(phoneNumber);
        code = code.match(/.{1,4}/g).join('-') || code;
        console.log(chalk.black(chalk.greenBright('Your pairing code:')), chalk.black(chalk.white(code)));
      }, 3000);
    }

    IX.ev.on("creds.update", await saveCreds);


    //-------------------------------------------------------------------------------------------------------------------------------------//


    IX.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === "close") {
        let reason = lastDisconnect.error
          ? lastDisconnect?.error?.output.statusCode
          : 0;
        if (reason === DisconnectReason.badSession) {
          console.log(`Bad Session File, Please Delete Session and Scan Again`);
          process.exit();
        } else if (reason === DisconnectReason.connectionClosed) {
          console.log("Connection closed, reconnecting....");
          startIX();
        } else if (reason === DisconnectReason.connectionLost) {
          console.log("Connection Lost from Server, reconnecting...");
          startIX();
        } else if (reason === DisconnectReason.connectionReplaced) {
          console.log(
            "Connection Replaced, Another New Session Opened, Please Close Current Session First"
          );
          process.exit();
        } else if (reason === DisconnectReason.loggedOut) {
          console.log(`Device Logged Out, Please Delete Session and Scan Again.`);
          process.exit();
        } else if (reason === DisconnectReason.restartRequired) {
          console.log("Restart Required, Restarting...");
          startIX();
        } else if (reason === DisconnectReason.timedOut) {
          console.log("Connection TimedOut, Reconnecting...");
          startIX();
        } else {
          console.log(`Unknown DisconnectReason: ${reason}|${connection}`);
        }
      }
      //console.log('Connected...', update)
      else if (connection === 'open') {
        const userName = IX.user.name ? IX.user.name : global.BotName;

        console.log(chalk.bold(chalk.cyan.blue('• User Info')));
        console.log(chalk.cyan(`- Name     : ${userName}`));
        console.log(chalk.cyan(`- Number   : ${IX.user.id.split(':')[0]}`));
        console.log(chalk.cyan(`- Status   : Connected`));
      }
    });


    //-------------------------------------------------------------------------------------------------------------------------------------//


    //
    IX.ws.on('CB:call', async (json) => {
      const callerId = json.content[0].attrs['call-creator']
      if (json.content[0].tag === 'offer') {
        try {
          let contactMessage = await IX.sendContact(callerId, global.Owner)
          await IX.sendMessage(callerId, { text: `Automatic Block System!\nDo not call this number!\nPlease unblock this number with permission from the Bot Owner.` }, { quoted: contactMessage })
          await sleep(8000)
          await IX.updateBlockStatus(callerId, "block")
        } catch (error) {
          console.error(error)
        }
      }
    })


    IX.ev.on("messages.upsert", async (chatUpdate) => {
      try {
        mek = chatUpdate.messages[0];
        if (!mek.message) return;
        mek.message =
          Object.keys(mek.message)[0] === "ephemeralMessage"
            ? mek.message.ephemeralMessage.message
            : mek.message;
        if (mek.key && mek.key.remoteJid === "status@broadcast") return;
        if (!IX.public && !mek.key.fromMe && chatUpdate.type === "notify")
          return;
        if (mek.key.id.startsWith("BAE5") && mek.key.id.length === 16) return;
        m = smsg(IX, mek, store);
        require("./Core")(IX, m, chatUpdate, store);
      } catch (err) {
        console.log(err);
      }
    });


    /* 
   IX.ev.on('groups.update', async pea => {
       
          try {     
          ppgc = await IX.profilePictureUrl(pea[0].id, 'image')
          } catch {
          ppgc = 'https://wallpapercave.com/wp/wp10524580.jpg'
          }
          let wm_fatih = { url : ppgc }
          if (pea[0].announce == true) {
          IX.send5ButImg(pea[0].id, `Grop has been *Closed!* Only *Admins* can send Messages!`, `${BotName}`, wm_fatih, [])
          } else if(pea[0].announce == false) {
          IX.send5ButImg(pea[0].id, `Grop has been *Opened!* Now *Everyone* can send Messages!`, `${BotName}`, wm_fatih, [])
          } else {
          IX.send5ButImg(pea[0].id, `Group Subject has been updated to *${pea[0].subject}*`, `${BotName}`, wm_fatih, [])
        }
       })
   */

    IX.ev.on('groups.update', async pea => {
      //console.log(pea)
      // Get Profile Picture Group
      try {
        ppgc = await IX.profilePictureUrl(pea[0].id, 'image')
      } catch {
        ppgc = 'https://telegra.ph/file/f62546d86769e8580043c.png'
      }
      let wm_fatih = { url: ppgc }
      if (pea[0].announce == true) {
        //IX.send5ButImg(pea[0].id, `Grop has been *Closed!* Only *Admins* can send Messages!`, `IX Bot`, wm_fatih, [])

        IX.sendMessage(m.chat, { image: wm_fatih, caption: 'Grop has been *Closed!* Only *Admins* can send Messages!' })
      } else if (pea[0].announce == false) {
        // IX.send5ButImg(pea[0].id, `Grop has been *Opened!* Now *Everyone* can send Messages!`, `IX Bot`, wm_fatih, [])
        IX.sendMessage(m.chat, { image: wm_fatih, caption: 'Grop has been *Opened!* Now *Everyone* can send Messages!' })
      } else if (pea[0].restrict == true) {
        //IX.send5ButImg(pea[0].id, `Group Info modification has been *Restricted*, Now only *Admins* can edit Group Info !`, `IX Bot`, wm_fatih, [])
        IX.sendMessage(m.chat, { image: wm_fatih, caption: 'Group Info modification has been *Restricted*, Now only *Admins* can edit Group Info !' })
      } else if (pea[0].restrict == false) {
        //IX.send5ButImg(pea[0].id, `Group Info modification has been *Un-Restricted*, Now only *Everyone* can edit Group Info !`, `IX Bot`, wm_fatih, [])
        IX.sendMessage(m.chat, { image: wm_fatih, caption: 'Group Info modification has been *Un-Restricted*, Now only *Everyone* can edit Group Info !' })
      } else {
        //IX.send5ButImg(pea[0].id, `Group Subject has been uhanged To:\n\n*${pea[0].subject}*`, `IX Bot`, wm_fatih, [])
        IXtextddfq = `Group Subject has been updated To:\n\n*${pea[0].subject}*`
        IX.sendMessage(pea[0].id, { image: wm_fatih, caption: IXtextddfq })
      }
    })



    function pickRandom(list) {
      return list[Math.floor(list.length * Math.random())]
    }


    //... Group event on off directlly.

    /* 
    
      IX.ev.on('group-participants.update', async (anu) => {
        console.log(anu)
    
        try {
          let metadata = await IX.groupMetadata(anu.id)
          let participants = anu.participants
          for (let num of participants) {
    
            try {
              ppuser = await IX.profilePictureUrl(num, 'image')
            } catch {
              ppuser = 'https://images6.alphacoders.com/690/690121.jpg'
            }
    
            try {
              ppgroup = await IX.profilePictureUrl(anu.id, 'image')
            } catch {
              ppgroup = 'https://telegra.ph/file/4cc2712eee93c105f6739.jpg'
            }
    
            let targetname = await IX.getName(num)
            grpmembernum = metadata.participants.length
    
    
            if (anu.action == 'add') {
              let WAuserName = num
              IXtext = `
    Hello @${WAuserName.split("@")[0]},
    
    I am *IX Bot*, Welcome to ${metadata.subject}.
    
    *Group Description:*
    ${metadata.desc}
    `
    
              let buttonMessage = {
                image: await getBuffer(ppgroup),
                mentions: [num],
                caption: IXtext,
                footer: `${global.BotName}`,
                headerType: 4,
              }
              IX.sendMessage(anu.id, buttonMessage)
            } else if (anu.action == 'remove') {
              let WAuserName = num
              IXtext = `
    Okay Bye 👋, @${WAuserName.split("@")[0]},
    
    I hope you will come back soon, but You will be missed!
    `
    
              let buttonMessage = {
                image: await getBuffer(ppuser),
                mentions: [num],
                caption: IXtext,
                footer: `${global.BotName}`,
                headerType: 4,
    
              }
              IX.sendMessage(anu.id, buttonMessage)
            }
          }
        } catch (err) {
          console.log(err)
        }
      });
    
  */


    // And then forget to add this config in IXs config

    // patchMessageBeforeSending: (message) => {
    //     const requiresPatch = !!(
    //         message.buttonsMessage 
    //         || message.templateMessage
    //         || message.listMessage
    //     );
    //     if (requiresPatch) {
    //         message = {
    //             viewOnceMessage: {
    //                 message: {
    //                     messageContextInfo: {
    //                         deviceListMetadataVersion: 2,
    //                         deviceListMetadata: {},
    //                     },
    //                     ...message,
    //                 },
    //             },
    //         };
    //     }

    //     return message;
    // },


    //... Groupevent handling

    IX.ev.on('group-participants.update', async (anu) => {
      if (global.groupevent) { // Check if group event handling is enabled ...
        console.log(anu);

        try {
          let metadata = await IX.groupMetadata(anu.id);
          let participants = anu.participants;
          for (let num of participants) {
            // ... existing logic for adding and removing participants ...

            try {
              ppuser = await IX.profilePictureUrl(num, 'image')
            } catch {
              ppuser = 'https://telegra.ph/file/f62546d86769e8580043c.png'
            }

            try {
              ppgroup = await IX.profilePictureUrl(anu.id, 'image')
            } catch {
              ppgroup = 'https://telegra.ph/file/f62546d86769e8580043c.png'
            }

            let targetname = await IX.getName(num)
            grpmembernum = metadata.participants.length


            if (anu.action == 'add') {
              // ... existing logic for welcoming new participants ...
              let WAuserName = num
              IXtext = `
Hello @${WAuserName.split("@")[0]},

I am *IX Bot*, Welcome to ${metadata.subject}.

*Group Description:*
${metadata.desc}
`

              let buttonMessage = {
                image: await getBuffer(ppgroup),
                mentions: [num],
                caption: IXtext,
                footer: `${global.BotName}`,
                headerType: 4,
              }
              IX.sendMessage(anu.id, buttonMessage)
            } else if (anu.action == 'remove') {
              // ... existing logic for saying goodbye to departing participants ...
              let WAuserName = num
              IXtext = `
Okay Bye 👋, @${WAuserName.split("@")[0]},

You'll be a noticeable absence!
`

              let buttonMessage = {
                image: await getBuffer(ppuser),
                mentions: [num],
                caption: IXtext,
                footer: `${global.BotName}`,
                headerType: 4,

              }
              IX.sendMessage(anu.id, buttonMessage)
            }
          }
        } catch (err) {
          console.log(err);
        }
      }
    });


    //
    IX.decodeJid = (jid) => {
      if (!jid) return jid;
      if (/:\d+@/gi.test(jid)) {
        let decode = jidDecode(jid) || {};
        return (
          (decode.user && decode.server && decode.user + "@" + decode.server) ||
          jid
        );
      } else return jid;
    };

    IX.ev.on("contacts.update", (update) => {
      for (let contact of update) {
        let id = IX.decodeJid(contact.id);
        if (store && store.contacts)
          store.contacts[id] = { id, name: contact.notify };
      }
    });

    IX.getName = (jid, withoutContact = false) => {
      id = IX.decodeJid(jid);
      withoutContact = IX.withoutContact || withoutContact;
      let v;
      if (id.endsWith("@g.us"))
        return new Promise(async (resolve) => {
          v = store.contacts[id] || {};
          if (!(v.name || v.subject)) v = IX.groupMetadata(id) || {};
          resolve(
            v.name ||
            v.subject ||
            PhoneNumber("+" + id.replace("@s.whatsapp.net", "")).getNumber(
              "international"
            )
          );
        });
      else
        v =
          id === "0@s.whatsapp.net"
            ? {
              id,
              name: "WhatsApp",
            }
            : id === IX.decodeJid(IX.user.id)
              ? IX.user
              : store.contacts[id] || {};
      return (
        (withoutContact ? "" : v.name) ||
        v.subject ||
        v.verifiedName ||
        PhoneNumber("+" + jid.replace("@s.whatsapp.net", "")).getNumber(
          "international"
        )
      );
    };

    IX.sendContact = async (jid, kon, quoted = "", opts = {}) => {
      let list = [];
      for (let i of kon) {
        list.push({
          displayName: await IX.getName(i + "@s.whatsapp.net"),
          vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${await IX.getName(
            i + "@s.whatsapp.net"
          )}\nFN:${global.OwnerName
            }\nitem1.TEL;waid=${i}:${i}\nitem1.X-ABLabel:Click here to chat\nitem2.EMAIL;type=INTERNET:${global.github
            }\nitem2.X-ABLabel:GitHub\nitem3.URL:${global.website
            }\nitem3.X-ABLabel:GitHub\nitem4.ADR:;;${global.location
            };;;;\nitem4.X-ABLabel:Region\nEND:VCARD`,
        });
      }
      IX.sendMessage(
        jid,
        {
          contacts: { displayName: `${list.length} Contact`, contacts: list },
          ...opts,
        },
        { quoted }
      );
    };

    IX.setStatus = (status) => {
      IX.query({
        tag: "iq",
        attrs: {
          to: "@s.whatsapp.net",
          type: "set",
          xmlns: "status",
        },
        content: [
          {
            tag: "status",
            attrs: {},
            content: Buffer.from(status, "utf-8"),
          },
        ],
      });
      return status;
    };

    IX.public = true;

    IX.serializeM = (m) => smsg(IX, m, store);







    // auto status seen ...
    const _0x3991b1 = _0x24be; function _0x4657() { const _0x16d819 = ['26697GyyGHG', '27UOxump', 'Error\x20reading\x20messages:', 'participant', '294wUpjBr', '7732mzYwWN', 'push', '1254371GIkUUm', 'readMessages', 'messages.upsert', '873NYGddy', 'error', '136zmOfiw', 'statusseen', 'Deleted\x20story❗', '3600123DiOjsB', 'status@broadcast', '2XPLZNn', 'shift', 'split', 'message', '10BcDgcz', '31860KZDZgJ', '24KLoQUS', 'key', '255473HAkLFI', '14219007XVkPts', '8196071AhMYXl', 'log', 'View\x20user\x20stories', '2104260FqkWHn', '2900wrgSlj', '2369756iVZGFf', '162369ppXChF', '1512vjHAym']; _0x4657 = function () { return _0x16d819; }; return _0x4657(); } function _0x24be(_0x5629d1, _0x2848d2) { const _0x46576f = _0x4657(); return _0x24be = function (_0x24beb1, _0x4a860f) { _0x24beb1 = _0x24beb1 - 0x1e1; let _0x554c0e = _0x46576f[_0x24beb1]; return _0x554c0e; }, _0x24be(_0x5629d1, _0x2848d2); } (function (_0x1b4b12, _0x52d1f3) { const _0xc4af2d = _0x24be, _0x8844a7 = _0x1b4b12(); while (!![]) { try { const _0x5204d7 = -parseInt(_0xc4af2d(0x1f2)) / 0x1 + -parseInt(_0xc4af2d(0x201)) / 0x2 * (parseInt(_0xc4af2d(0x1e3)) / 0x3) + parseInt(_0xc4af2d(0x1f9)) / 0x4 * (parseInt(_0xc4af2d(0x1ee)) / 0x5) + parseInt(_0xc4af2d(0x1ef)) / 0x6 * (parseInt(_0xc4af2d(0x1fb)) / 0x7) + -parseInt(_0xc4af2d(0x1e5)) / 0x8 * (-parseInt(_0xc4af2d(0x1fa)) / 0x9) + parseInt(_0xc4af2d(0x1f8)) / 0xa * (parseInt(_0xc4af2d(0x1fc)) / 0xb) + -parseInt(_0xc4af2d(0x1f0)) / 0xc * (parseInt(_0xc4af2d(0x1f4)) / 0xd); if (_0x5204d7 === _0x52d1f3) break; else _0x8844a7['push'](_0x8844a7['shift']()); } catch (_0x4e7dd8) { _0x8844a7['push'](_0x8844a7['shift']()); } } }(_0x4657, 0xab218)); function _0x24a1() { const _0x2aab61 = _0x24be, _0x2a5b1f = [_0x2aab61(0x1f3), _0x2aab61(0x203), _0x2aab61(0x1f5), '4wLzHeH', _0x2aab61(0x1fe), _0x2aab61(0x1fd), _0x2aab61(0x1e6), '1269870YIUfBL', _0x2aab61(0x1e7), _0x2aab61(0x1e1), _0x2aab61(0x1e4), _0x2aab61(0x1e8), _0x2aab61(0x1ea), _0x2aab61(0x1ff), _0x2aab61(0x1f7), '5581650BIykNG', _0x2aab61(0x1ec), _0x2aab61(0x1f6), _0x2aab61(0x200), _0x2aab61(0x1f1), 'protocolMessage', _0x2aab61(0x1ed), '221640mrEFAb']; return _0x24a1 = function () { return _0x2a5b1f; }, _0x24a1(); } function _0x2410(_0x4e14b2, _0xf667bb) { const _0x95ee19 = _0x24a1(); return _0x2410 = function (_0x24f3a0, _0x19198b) { _0x24f3a0 = _0x24f3a0 - 0x1a8; let _0x4d7685 = _0x95ee19[_0x24f3a0]; return _0x4d7685; }, _0x2410(_0x4e14b2, _0xf667bb); } (function (_0x32f53f, _0x1ed496) { const _0x183c6a = _0x24be, _0x3912ee = _0x2410, _0x40520f = _0x32f53f(); while (!![]) { try { const _0x6ac6d2 = parseInt(_0x3912ee(0x1ba)) / 0x1 * (parseInt(_0x3912ee(0x1ae)) / 0x2) + parseInt(_0x3912ee(0x1ad)) / 0x3 * (-parseInt(_0x3912ee(0x1bc)) / 0x4) + parseInt(_0x3912ee(0x1b0)) / 0x5 + parseInt(_0x3912ee(0x1b1)) / 0x6 + -parseInt(_0x3912ee(0x1b4)) / 0x7 * (-parseInt(_0x3912ee(0x1b8)) / 0x8) + -parseInt(_0x3912ee(0x1be)) / 0x9 * (parseInt(_0x3912ee(0x1a9)) / 0xa) + -parseInt(_0x3912ee(0x1b9)) / 0xb; if (_0x6ac6d2 === _0x1ed496) break; else _0x40520f[_0x183c6a(0x202)](_0x40520f['shift']()); } catch (_0x5620d8) { _0x40520f[_0x183c6a(0x202)](_0x40520f[_0x183c6a(0x1eb)]()); } } }(_0x24a1, 0xda9ed), IX['ev']['on'](_0x3991b1(0x1e2), async ({ messages: _0x3b6d62 }) => { const _0x4d81e8 = _0x3991b1, _0x2e9fe2 = _0x2410, _0x2ebfd1 = _0x3b6d62[0x0]; if (!_0x2ebfd1[_0x4d81e8(0x1ed)]) return; _0x2ebfd1[_0x4d81e8(0x1f1)]['remoteJid'] === _0x4d81e8(0x1e9) && global[_0x2e9fe2(0x1a8)] && setTimeout(async () => { const _0xb70676 = _0x2e9fe2; try { await IX[_0xb70676(0x1ab)]([_0x2ebfd1[_0xb70676(0x1b5)]]), console[_0xb70676(0x1bb)](_0x2ebfd1[_0xb70676(0x1b5)][_0xb70676(0x1af)][_0xb70676(0x1b2)]('@')[0x0] + '\x20' + (_0x2ebfd1[_0xb70676(0x1b7)][_0xb70676(0x1b6)] ? _0xb70676(0x1aa) : _0xb70676(0x1b3))); } catch (_0x72cc89) { console[_0xb70676(0x1ac)](_0xb70676(0x1bd), _0x72cc89); } }, 0x1f4); }));



    /** Send Button 5 Images
     *
     * @param {*} jid
     * @param {*} text
     * @param {*} footer
     * @param {*} image
     * @param [*] button
     * @param {*} options
     * @returns
     */
    IX.send5ButImg = async (
      jid,
      text = "",
      footer = "",
      img,
      but = [],
      thumb,
      options = {}
    ) => {
      let message = await prepareWAMessageMedia(
        { image: img, jpegThumbnail: thumb },
        { upload: IX.waUploadToServer }
      );
      var template = generateWAMessageFromContent(
        m.chat,
        proto.Message.fromObject({
          templateMessage: {
            hydratedTemplate: {
              imageMessage: message.imageMessage,
              hydratedContentText: text,
              hydratedFooterText: footer,
              hydratedButtons: but,
            },
          },
        }),
        options
      );
      IX.relayMessage(jid, template.message, { messageId: template.key.id });
    };

    /**
     *
     * @param {*} jid
     * @param {*} buttons
     * @param {*} caption
     * @param {*} footer
     * @param {*} quoted
     * @param {*} options
     */
    IX.sendButtonText = (
      jid,
      buttons = [],
      text,
      footer,
      quoted = "",
      options = {}
    ) => {
      let buttonMessage = {
        text,
        footer,
        buttons,
        headerType: 2,
        ...options,
      };
      IX.sendMessage(jid, buttonMessage, { quoted, ...options });
    };

    /**
     *
     * @param {*} jid
     * @param {*} text
     * @param {*} quoted
     * @param {*} options
     * @returns
     */
    IX.sendText = (jid, text, quoted = "", options) =>
      IX.sendMessage(jid, { text: text, ...options }, { quoted });

    /**
     *
     * @param {*} jid
     * @param {*} path
     * @param {*} caption
     * @param {*} quoted
     * @param {*} options
     * @returns
     */
    IX.sendImage = async (jid, path, caption = "", quoted = "", options) => {
      let buffer = Buffer.isBuffer(path)
        ? path
        : /^data:.*?\/.*?;base64,/i.test(path)
          ? Buffer.from(path.split`,`[1], "base64")
          : /^https?:\/\//.test(path)
            ? await await getBuffer(path)
            : fs.existsSync(path)
              ? fs.readFileSync(path)
              : Buffer.alloc(0);
      return await IX.sendMessage(
        jid,
        { image: buffer, caption: caption, ...options },
        { quoted }
      );
    };

    /**
     *
     * @param {*} jid
     * @param {*} path
     * @param {*} caption
     * @param {*} quoted
     * @param {*} options
     * @returns
     */
    IX.sendVideo = async (
      jid,
      path,
      caption = "",
      quoted = "",
      gif = false,
      options
    ) => {
      let buffer = Buffer.isBuffer(path)
        ? path
        : /^data:.*?\/.*?;base64,/i.test(path)
          ? Buffer.from(path.split`,`[1], "base64")
          : /^https?:\/\//.test(path)
            ? await await getBuffer(path)
            : fs.existsSync(path)
              ? fs.readFileSync(path)
              : Buffer.alloc(0);
      return await IX.sendMessage(
        jid,
        { video: buffer, caption: caption, gifPlayback: gif, ...options },
        { quoted }
      );
    };

    /**
     *
     * @param {*} jid
     * @param {*} path
     * @param {*} quoted
     * @param {*} mime
     * @param {*} options
     * @returns
     */
    IX.sendAudio = async (jid, path, quoted = "", ptt = false, options) => {
      let buffer = Buffer.isBuffer(path)
        ? path
        : /^data:.*?\/.*?;base64,/i.test(path)
          ? Buffer.from(path.split`,`[1], "base64")
          : /^https?:\/\//.test(path)
            ? await await getBuffer(path)
            : fs.existsSync(path)
              ? fs.readFileSync(path)
              : Buffer.alloc(0);
      return await IX.sendMessage(
        jid,
        { audio: buffer, ptt: ptt, ...options },
        { quoted }
      );
    };

    /**
     *
     * @param {*} jid
     * @param {*} text
     * @param {*} quoted
     * @param {*} options
     * @returns
     */
    IX.sendTextWithMentions = async (jid, text, quoted, options = {}) =>
      IX.sendMessage(
        jid,
        {
          text: text,
          contextInfo: {
            mentionedJid: [...text.matchAll(/@(\d{0,16})/g)].map(
              (v) => v[1] + "@s.whatsapp.net"
            ),
          },
          ...options,
        },
        { quoted }
      );

    /**
     *
     * @param {*} jid
     * @param {*} path
     * @param {*} quoted
     * @param {*} options
     * @returns
     */
    IX.sendImageAsSticker = async (jid, path, quoted, options = {}) => {
      let buff = Buffer.isBuffer(path)
        ? path
        : /^data:.*?\/.*?;base64,/i.test(path)
          ? Buffer.from(path.split`,`[1], "base64")
          : /^https?:\/\//.test(path)
            ? await await getBuffer(path)
            : fs.existsSync(path)
              ? fs.readFileSync(path)
              : Buffer.alloc(0);
      let buffer;
      if (options && (options.packname || options.author)) {
        buffer = await writeExifImg(buff, options);
      } else {
        buffer = await imageToWebp(buff);
      }

      await IX.sendMessage(
        jid,
        { sticker: { url: buffer }, ...options },
        { quoted }
      );
      return buffer;
    };

    /**
     *
     * @param {*} jid
     * @param {*} path
     * @param {*} quoted
     * @param {*} options
     * @returns
     */
    IX.sendVideoAsSticker = async (jid, path, quoted, options = {}) => {
      let buff = Buffer.isBuffer(path)
        ? path
        : /^data:.*?\/.*?;base64,/i.test(path)
          ? Buffer.from(path.split`,`[1], "base64")
          : /^https?:\/\//.test(path)
            ? await await getBuffer(path)
            : fs.existsSync(path)
              ? fs.readFileSync(path)
              : Buffer.alloc(0);
      let buffer;
      if (options && (options.packname || options.author)) {
        buffer = await writeExifVid(buff, options);
      } else {
        buffer = await videoToWebp(buff);
      }

      await IX.sendMessage(
        jid,
        { sticker: { url: buffer }, ...options },
        { quoted }
      );
      return buffer;
    };
    IX.sendMedia = async (
      jid,
      path,
      fileName = "",
      caption = "",
      quoted = "",
      options = {}
    ) => {
      let types = await IXgetFile(path, true);
      let { mime, ext, res, data, filename } = types;
      if ((res && res.status !== 200) || file.length <= 65536) {
        try {
          throw { json: JSON.parse(file.toString()) };
        } catch (e) {
          if (e.json) throw e.json;
        }
      }
      let type = "",
        mimetype = mime,
        pathFile = filename;
      if (options.asDocument) type = "document";
      if (options.asSticker || /webp/.test(mime)) {
        let { writeExif } = require("./lib/exif");
        let media = { mimetype: mime, data };
        pathFile = await writeExif(media, {
          packname: options.packname ? options.packname : global.packname,
          author: options.author ? options.author : global.author,
          categories: options.categories ? options.categories : [],
        });
        await fs.promises.unlink(filename);
        type = "sticker";
        mimetype = "image/webp";
      } else if (/image/.test(mime)) type = "image";
      else if (/video/.test(mime)) type = "video";
      else if (/audio/.test(mime)) type = "audio";
      else type = "document";
      await IX.sendMessage(
        jid,
        { [type]: { url: pathFile }, caption, mimetype, fileName, ...options },
        { quoted, ...options }
      );
      return fs.promises.unlink(pathFile);
    };
    /**
     *
     * @param {*} message
     * @param {*} filename
     * @param {*} attachExtension
     * @returns
     */
    IX.downloadAndSaveMediaMessage = async (
      message,
      filename,
      attachExtension = true
    ) => {
      let quoted = message.msg ? message.msg : message;
      let mime = (message.msg || message).mimetype || "";
      let messageType = message.mtype
        ? message.mtype.replace(/Message/gi, "")
        : mime.split("/")[0];
      const stream = await downloadContentFromMessage(quoted, messageType);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }
      let type = await FileType.fromBuffer(buffer);
      trueFileName = attachExtension ? filename + "." + type.ext : filename;
      // save to file
      await fs.writeFileSync(trueFileName, buffer);
      return trueFileName;
    };

    IX.downloadMediaMessage = async (message) => {
      let mime = (message.msg || message).mimetype || "";
      let messageType = message.mtype
        ? message.mtype.replace(/Message/gi, "")
        : mime.split("/")[0];
      const stream = await downloadContentFromMessage(message, messageType);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      return buffer;
    };

    /**
     *
     * @param {*} jid
     * @param {*} message
     * @param {*} forceForward
     * @param {*} options
     * @returns
     */
    IX.copyNForward = async (
      jid,
      message,
      forceForward = false,
      options = {}
    ) => {
      let vtype;
      if (options.readViewOnce) {
        message.message =
          message.message &&
            message.message.ephemeralMessage &&
            message.message.ephemeralMessage.message
            ? message.message.ephemeralMessage.message
            : message.message || undefined;
        vtype = Object.keys(message.message.viewOnceMessage.message)[0];
        delete (message.message && message.message.ignore
          ? message.message.ignore
          : message.message || undefined);
        delete message.message.viewOnceMessage.message[vtype].viewOnce;
        message.message = {
          ...message.message.viewOnceMessage.message,
        };
      }

      let mtype = Object.keys(message.message)[0];
      let content = await generateForwardMessageContent(message, forceForward);
      let ctype = Object.keys(content)[0];
      let context = {};
      if (mtype != "conversation") context = message.message[mtype].contextInfo;
      content[ctype].contextInfo = {
        ...context,
        ...content[ctype].contextInfo,
      };
      const waMessage = await generateWAMessageFromContent(
        jid,
        content,
        options
          ? {
            ...content[ctype],
            ...options,
            ...(options.contextInfo
              ? {
                contextInfo: {
                  ...content[ctype].contextInfo,
                  ...options.contextInfo,
                },
              }
              : {}),
          }
          : {}
      );
      await IX.relayMessage(jid, waMessage.message, {
        messageId: waMessage.key.id,
      });
      return waMessage;
    };

    IX.sendListMsg = (
      jid,
      text = "",
      footer = "",
      title = "",
      butText = "",
      sects = [],
      quoted
    ) => {
      let sections = sects;
      var listMes = {
        text: text,
        footer: footer,
        title: title,
        buttonText: butText,
        sections,
      };
      IX.sendMessage(jid, listMes, { quoted: quoted });
    };

    IX.cMod = (
      jid,
      copy,
      text = "",
      sender = IX.user.id,
      options = {}
    ) => {
      //let copy = message.toJSON()
      let mtype = Object.keys(copy.message)[0];
      let isEphemeral = mtype === "ephemeralMessage";
      if (isEphemeral) {
        mtype = Object.keys(copy.message.ephemeralMessage.message)[0];
      }
      let msg = isEphemeral
        ? copy.message.ephemeralMessage.message
        : copy.message;
      let content = msg[mtype];
      if (typeof content === "string") msg[mtype] = text || content;
      else if (content.caption) content.caption = text || content.caption;
      else if (content.text) content.text = text || content.text;
      if (typeof content !== "string")
        msg[mtype] = {
          ...content,
          ...options,
        };
      if (copy.key.participant)
        sender = copy.key.participant = sender || copy.key.participant;
      else if (copy.key.participant)
        sender = copy.key.participant = sender || copy.key.participant;
      if (copy.key.remoteJid.includes("@s.whatsapp.net"))
        sender = sender || copy.key.remoteJid;
      else if (copy.key.remoteJid.includes("@broadcast"))
        sender = sender || copy.key.remoteJid;
      copy.key.remoteJid = jid;
      copy.key.fromMe = sender === IX.user.id;

      return proto.WebMessageInfo.fromObject(copy);
    };

    /**
     *
     * @param {*} path
     * @returns
     */
    IX.getFile = async (PATH, save) => {
      let res;
      let data = Buffer.isBuffer(PATH)
        ? PATH
        : /^data:.*?\/.*?;base64,/i.test(PATH)
          ? Buffer.from(PATH.split`,`[1], "base64")
          : /^https?:\/\//.test(PATH)
            ? await (res = await getBuffer(PATH))
            : fs.existsSync(PATH)
              ? ((filename = PATH), fs.readFileSync(PATH))
              : typeof PATH === "string"
                ? PATH
                : Buffer.alloc(0);
      //if (!Buffer.isBuffer(data)) throw new TypeError('Result is not a buffer')
      let type = (await FileType.fromBuffer(data)) || {
        mime: "application/octet-stream",
        ext: ".bin",
      };
      filename = path.join(
        __filename,
        "../src/" + new Date() * 1 + "." + type.ext
      );
      if (data && save) fs.promises.writeFile(filename, data);
      return {
        res,
        filename,
        size: await getSizeMedia(data),
        ...type,
        data,
      };
    };

    IX.send5ButGif = async (
      jid,
      text = "",
      footer = "",
      gif,
      but = [],
      options = {}
    ) => {
      let message = await prepareWAMessageMedia(
        { video: gif, gifPlayback: true },
        { upload: IX.waUploadToServer }
      );
      var template = generateWAMessageFromContent(
        jid,
        proto.Message.fromObject({
          templateMessage: {
            hydratedTemplate: {
              videoMessage: message.videoMessage,
              hydratedContentText: text,
              hydratedFooterText: footer,
              hydratedButtons: but,
            },
          },
        }),
        options
      );
      IX.relayMessage(jid, template.message, { messageId: template.key.id });
    };

    IX.send5ButVid = async (
      jid,
      text = "",
      footer = "",
      vid,
      but = [],
      options = {}
    ) => {
      let message = await prepareWAMessageMedia(
        { video: vid },
        { upload: IX.waUploadToServer }
      );
      var template = generateWAMessageFromContent(
        jid,
        proto.Message.fromObject({
          templateMessage: {
            hydratedTemplate: {
              videoMessage: message.videoMessage,
              hydratedContentText: text,
              hydratedFooterText: footer,
              hydratedButtons: but,
            },
          },
        }),
        options
      );
      IX.relayMessage(jid, template.message, { messageId: template.key.id });
    };
    //send5butmsg
    IX.send5ButMsg = (jid, text = "", footer = "", but = []) => {
      let templateButtons = but;
      var templateMessage = {
        text: text,
        footer: footer,
        templateButtons: templateButtons,
      };
      IX.sendMessage(jid, templateMessage);
    };

    IX.sendFile = async (jid, PATH, fileName, quoted = {}, options = {}) => {
      let types = await IX.getFile(PATH, true);
      let { filename, size, ext, mime, data } = types;
      let type = "",
        mimetype = mime,
        pathFile = filename;
      if (options.asDocument) type = "document";
      if (options.asSticker || /webp/.test(mime)) {
        let { writeExif } = require("./lib/sticker.js");
        let media = { mimetype: mime, data };
        pathFile = await writeExif(media, {
          packname: global.packname,
          author: global.packname,
          categories: options.categories ? options.categories : [],
        });
        await fs.promises.unlink(filename);
        type = "sticker";
        mimetype = "image/webp";
      } else if (/image/.test(mime)) type = "image";
      else if (/video/.test(mime)) type = "video";
      else if (/audio/.test(mime)) type = "audio";
      else type = "document";
      await IX.sendMessage(
        jid,
        { [type]: { url: pathFile }, mimetype, fileName, ...options },
        { quoted, ...options }
      );
      return fs.promises.unlink(pathFile);
    };
    IX.parseMention = async (text) => {
      return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(
        (v) => v[1] + "@s.whatsapp.net"
      );
    };

    return IX;


  } catch (error) {
    console.error(error);
  }



}

process.on('uncaughtException', function (err) {
  let e = String(err)
  if (e.includes("Socket connection timeout")) return
  if (e.includes("not-authorized")) return
  if (e.includes("already-exists")) return
  if (e.includes("rate-overlimit")) return
  if (e.includes("Connection Closed")) return
  if (e.includes("Timed Out")) return
  if (e.includes("Value not found")) return
  console.log('Caught exception: ', err)
})

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`${__filename} Updated`));
  delete require.cache[file];
  require(file);

});
