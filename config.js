const fs = require("fs");
const chalk = require("chalk");
require("dotenv").config();

// Default values for global variables
global.available = process.env.AVAILABLE || true;
global.autoReadAll = process.env.AUTO_READ_ALL || false;
global.antitags = process.env.ANTITAGS || true;

// Auto functioner
global.autoTyping = process.env.AUTO_TYPING || false;
global.autoRecord = process.env.AUTO_RECORD || false;
global.groupevent = process.env.GROUPEVENT || false;
global.statusseen = process.env.STATUSSEEN || true;
global.autoreadgc = process.env.AUTOREADGC || true;


// Auth information
global.pairNumber = "6285175366561";                         // Add your paining number with country code example "916297175943"; 
global.port = process.env.PORT || "10000";
global.auth = process.env.AUTH || "Pairing";                // Auth mode OR/Pairing.
global.sessionFile = process.env.SESSION_FILE || "IX-SESSION";
global.mongodb = process.env.MONGODB || "";                 // Mongodb url.
global.website = "https://porto.aryok.me"; 
global.github = "https://github.com/ryasya";


// Default prefix
global.prefa = process.env.PREFIX ? process.env.PREFIX.split(",") : ["."];


// Owner information
global.Owner = process.env.OWNER ? process.env.OWNER.split(",") : ["6282265468133"];
global.OwnerNumber = process.env.OWNER_NUMBER ? process.env.OWNER_NUMBER.split(",") : ["6282265468133"];
global.ownertag = process.env.OWNER_TAG ? process.env.OWNER_TAG.split(",") : ["6282265468133"];
global.OwnerName = process.env.OWNER_NAME || "Yoks";
global.BotName = process.env.BOT_NAME || "ix";
global.packname = process.env.PACK_NAME || "ix Bot";
global.author = "By: Yoks";
global.BotSourceCode = "https://github.com/Swatika666/ix";
global.SupportGroupLink = "#";


//

global.location = process.env.LOCATION || "IX, XXX";
global.reactmoji = process.env.REACT_MOJI || "❤️";
global.themeemoji = process.env.THEME_EMOJI || "💖";
global.vidmenu = { url: process.env.VID_MENU_URL || 'https://i.giphy.com/media/v1.Y2lkPTc5MGI3NjExczd0MWk0bjkwNGZpb2d4ZGFzZjE1OG5ma2JndmJnN2x4cTFhY2ZnNyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/LMcYkCTUyuVQJehdw1/giphy.gif' };


//
global.BotLogo = "https://telegra.ph/file/c8700447bb242a9f2b837.png";
global.Thumb = "https://telegra.ph/file/c8700447bb242a9f2b837.png";
global.Thumb1 = "https://telegra.ph/file/c8700447bb242a9f2b837.png";
global.ErrorPic = "https://telegra.ph/file/c8700447bb242a9f2b837.png";
global.them = "https://telegra.ph/file/f62546d86769e8580043c.png";


//
global.ntilinkytvid = []
global.ntilinkytch = []
global.ntilinkig = []
global.ntilinkfb = []
global.ntilinktg = []
global.ntilinktt = []
global.ntilinktwt = []
global.ntilinkall = []
global.nticall = []
global.ntwame = []
global.nttoxic = []
global.ntnsfw = []
global.ntvirtex = []
global.rkyt = []
global.wlcm = []
global.gcrevoke = []
global.autorep = []
global.ntilink = []


// Messages
global.mess = {
  jobdone: 'Here you go...',
  useradmin: 'Sorry, only *Group Admins* can use this command *Baka*!',
  botadmin: 'Sorry, i cant execute this command without being an *Admin* of this group.',
  botowner: 'Only my *Owner* can use this command, Baka!',
  grouponly: 'This command is only made for *Groups*, Baka!',
  privateonly: 'This command is only made for *Private Chat*, Baka!',
  botonly: 'Only the *Bot itself* can use this command!',
  waiting: 'Just Wait...',
  nolink: 'Please provide me *link*',
  error: 'An error occurd!',
  banned: 'You are *Banned* fron using commands!',
  bangc: 'This Group is *Banned* from using Commands!',
  nonsfw: 'Dont be a pervert Baka! This is not a NSFW enabled group!'

}