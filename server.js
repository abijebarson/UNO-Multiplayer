const express = require('express');
const { disconnect } = require('process');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http,  {pingInterval:5000, pingTimeout:20000});
const port = 3000;

app.use(express.static(__dirname + '/public'));
io.on('connection', onConnection);
http.listen(port, () => console.log('listening on port ' + port));

const maxPeople = 30;
const noOfInitHand = 7;
const minPlayers = 1

let cardColors = {
  green: 'Green',
  red: 'Red',
  blue: 'Blue',
  yellow: 'Yellow',
  black: ''
}

let baseColors = {
  green: ['#55aa55', '#3b763b'],
  red: ['#ff5555', '#cc4343'],
  blue: ['#4343cc', '#323299'],
  yellow: ['#ffaa00', '#cc8800'],
  black: ['#555555', '#222222']
}

let deck = Array.apply(null, Array(112)).map(function (_, i) {return i;});
deck.splice(56, 1); //56
deck.splice(69, 1); //70
deck.splice(82, 1); //84
deck.splice(95, 1); //98

let data = [];
let players = {}
let disconplayers = {}
function init(){
  data['gameid'] = null;
  data['playing'] = false
  data['deck'] = [];
  data['reverse'] = 0;
  data['turn'] = 0;
  data['cardOnBoard'] = 0;
  data['wildcolor'] = null
  discomplayers = {}
}
data["playerids"] = []
players = {}
init()

function startGame() {
  io.emit('gameStateChange', 'play')
  data.gameid = guidGenerator()
  
  console.log('>> Requesting game...');
  let playerids = data.playerids 
  let people = data.playerids.length;
  console.log(data.playerids)
  console.log('People count : ' + io.engine.clientsCount + '==' + people)
  // try {
  //   people = io.engine.clientsCount
  // } catch (e) {
  //   console.log('>> No people here...');
  //   return;
  // }

  if (people >= minPlayers) {
    console.log('>> Starting: ', data.gameid)
    console.log(">> With Players: ", playerids)
    for (let i = 0; i < people; i++) {
      let playerName = io.sockets.sockets.get(playerids[i]).playerName;
      players[playerids[i]].name = playerName;
      console.log('>> Created '  + playerName +' (' + playerids[i] + ') is Player ' + i);
    }
    
    data['turn'] = playerids[0]
    
    //Shuffle a copy of a new deck
    let newDeck = [...deck];
    shuffle(newDeck);
    data['deck'] = newDeck;
    console.log('>>  Shuffling deck');
    
    //Every player draws a card.
    //Player with the highest point value is the dealer.
    let scores = new Array(people);
    do {
      console.log('>> Deciding dealer');
      for (let i = 0, card = 0, score = 0; i < people; i++) {
        card = parseInt(newDeck.shift());
        newDeck.push(card);
        score = cardScore(card);
        console.log('>> Player ' + i + ' draws ' + cardType(card) +
        ' ' + cardColor(card) + ' and gets ' + score + ' points');
        scores[i] = score;
      }
    } while (new Set(scores).size !== scores.length);
    let dealer = scores.indexOf(Math.max(...scores));
    console.log('>> The dealer is Player ' + dealer);
    
    //Each player is dealt 7 cards
    for (let i = 0, card = 0; i < people * noOfInitHand; i++) {
      let player = (i + dealer + 1) % people;
      card = parseInt(newDeck.shift());
      players[data.playerids[player]]['hand'].push(card);
      console.log('>>  Player ' + player + ' draws '
        + cardType(card) + ' ' + cardColor(card));
      }
      
      let cardOnBoard;
      do {
        cardOnBoard = parseInt(newDeck.shift());
        console.log('>> Card on board ' + cardType(cardOnBoard) + ' ' + cardColor(cardOnBoard));
          if (cardColor(cardOnBoard) === 'black') {
            newDeck.push(cardOnBoard);
            console.log('>> Replacing for another card');
          } else {
            break;
          }
        } while (true);
        
        data['cardOnBoard'] = cardOnBoard;
        
        data['turn'] = data["playerids"][(dealer + 1) % people]
        data['reverse'] = 0;
        
        if (cardType(cardOnBoard) === 'Draw2') {
          card = parseInt(newDeck.shift());
          players[data['turn']]['hand'].push(card);
          console.log('>> Player draws ' + cardType(card) + ' ' + cardColor(card));
          card = parseInt(newDeck.shift());
          players[data['turn']]['hand'].push(card);
          console.log('>> Player draws ' + cardType(card) + ' ' + cardColor(card));
          
          data['turn'] = data["playerids"][(dealer + 2) % people];
        } else if (cardType(cardOnBoard) === 'Reverse') {
          data['turn'] = data["playerids"][Math.abs(dealer - 1) % people];
          data['reverse'] = 1;
        } else if (cardType(cardOnBoard) === 'Skip') {
          data['turn'] = data["playerids"][(dealer + 2) % people];
        }
        
        console.log(data['turn'])
        console.log('>> Turn is for ' + players[data['turn']].name);
        console.log('>> Reverse (' + (!!data['reverse']) + ')');
        
        for (let i = 0; i < people; i++) {
          io.to(data.playerids[i]).emit('haveCard', [players[data.playerids[i]]['hand'], null]);
    }
    io.emit('turnPlayer', data['turn']);
    io.emit('sendCard', data['cardOnBoard']);
    io.emit('changeColor', baseColors[cardColor(data['cardOnBoard'])]);
  } else {
    console.log('>> Not enough people...');
  }
}

  function onConnection(socket) {
    socket.on('requestNewGame', function(playerName) {
    console.log("______________________________________________")
    console.log("                NEW CONNECTION                ")
    console.log("")
    console.log("New player: " + playerName)
    socket.playerName = playerName;
    console.log(playerName + '(' + socket.id + ') is requesting a game.')
    if (data.playerids.length < maxPeople && !data['playing'] && !(data.playerids.includes(socket.id))) {
      let playerid = socket.id
      players[playerid] = {}
      players[playerid]['name'] = playerName 
      players[playerid]['hand'] = [] 
      players[playerid]['ready'] = false
      players[playerid]['unoclaim'] = false
      io.emit('joiningGame', 'success');
      data.playerids.push(socket.id)
      console.log('>>>>>>>>>>>>>>>>>>> ', data.playerids)
      console.log('>> User ' + socket.playerName + ' connected '  + ' (' + (data.playerids.length) + '/' + maxPeople + ')');
      console.log("") 
      console.log("              NEW CONNECTION SUCCESS           ")
      console.log("_______________________________________________")
      return;
    } else if (data.playerids.includes(socket.id)) {
      io.to(socket.id).emit('joiningGame', 'duplicate');
      console.log("")
      console.log("         DUPLICATE CONNECTION ATTEMPT          ")
      console.log("_______________________________________________")
      return
    }
    io.to(socket.id).emit('joiningGame', 'error');
    console.log('>> Player tried to join in an unfortunate situation');
    console.log("")
    console.log("              NEW CONNECTION FAILED            ")
    console.log("_______________________________________________")
  });
      
  socket.on('requestCurrentGame', (resumeid) => {
    console.log("______________________________________________")
    console.log("                RECONNECTION                  ")
    console.log("")
    console.log("Recovering player: " + resumeid)
    console.log('in discomplayer:' + disconplayers[resumeid])
    if (io.engine.clientsCount <= 1){
      console.log("Only one player. Discarding the current game.")
      io.to(socket.id).emit('recoveryFeedback', ['failed', null])
      init()
    }
    if (resumeid && disconplayers[resumeid] && data.playing){
      players[socket.id] = {...disconplayers[resumeid]}
      delete disconplayers[resumeid]
      players[socket.id].ready = true
      players[socket.id].unoclaim = false
      socket.playerName = players[socket.id].name
      console.log(io.sockets.sockets.get(socket.id).playerName)
      data.playerids.push(socket.id)
      // console.log(socket.playerName)
      io.to(socket.id).emit('recoveryFeedback', ['success', players[socket.id]])
      io.emit('broadcastmsg', players[socket.id].name + " reconnected.")
      io.emit('sendCard', data['cardOnBoard']);
      console.log("PLAYERS: ", players)
      console.log("DISCONPLAYERS: ", disconplayers)
      console.log('playerids: ', data.playerids)
      console.log("")
      console.log("RECONNECTION SUCCESS")
      console.log("_______________________________________________")
      return
    }
    delete disconplayers[resumeid]    
    io.to(socket.id).emit('recoveryFeedback', ['failed', null])
    console.log("PLAYERS: ", players)
    console.log("DISCONPLAYERS: ", disconplayers)
    console.log('playerids: ', data.playerids)
    console.log("")
    console.log("RECONNECTION FAILED")
    console.log("_______________________________________________")
  })
  
  socket.on('readypressed', function(pname){
    if(!players[socket.id]){
      return
    }
    players[socket.id].ready = true
    console.log(data.playerids.length)
    if (data.playerids.length >= minPlayers && checkReady()) {
      init()
      data['playing'] = true;
      startGame();
    }
  })
  
  socket.on('disconnect', function(reason) {
    console.log("______________________________________________")
    console.log("                DISCONNECTION ")
    console.log("")
    console.log('>> Player ' + socket.playerName + ' ('+ socket.id + ') disconnected');
    console.log('>> Disconnected reason: ', reason);
    if (socket.id == data.turn){
      data.turn = data["playerids"][Math.abs(data["playerids"].indexOf(data['turn']) + (-1) ** data['reverse']) % data.playerids.length]
      io.emit('turnPlayer', data['turn']);
    }
    if (data.playing && data.playerids.length > 1){
      console.log(">> Saving playerinfo")
      disconplayers[socket.id] = {...players[socket.id]}
      if (players[socket.id]){
        io.emit('broadcastmsg', players[socket.id].name + " disconnected.")
      }
    }
    console.log("test print", players[socket.id])
    delete players[socket.id]
    console.log("test print", players[socket.id])
    data.playerids = data.playerids.filter(id => id !== socket.id)
    console.log("PLAYERS: ", players)
    console.log("DISCONPLAYERS: ", disconplayers)
    console.log('playerids: ', data.playerids)
    console.log("")
    console.log("")
    console.log("______________________________________________")
  });
  
  socket.on('claimUNO', () => {
    io.emit('broadcastmsg', players[socket.id].name + " DID UNO!!! 1 step away from winning!")
    players[socket.id].unoclaim = true;
  })
  
  socket.on('drawCard', function() {
    if (data.deck.length <= 1){
      data.deck = [...deck]
      shuffle(data.deck)
      console.log('Refreshing deck!')
      io.emit('broadcastmsg', "Refreshing deck!")
    }
    let deck = data['deck'];
    
    if (data['turn'] === socket.id) {
      let card = drawCards(socket.id, 1)[0]
      console.log('>> ' + players[socket.id].name + ' draws a card: ' + cardType(card) + ' ' + cardColor(card))
      io.emit('broadcastmsg', players[socket.id].name + ' draws a card from the deck')
      if(!isPlayable(card)){
        data['turn'] = data["playerids"][Math.abs(data["playerids"].indexOf(data['turn']) + (-1) ** data['reverse']) % data.playerids.length];
      }
      io.emit('turnPlayer', data['turn']);
    }
  });
  
  socket.on('playCard', function(res) {
    
    //EMPTY DECK RESET
    if (data.deck.length <= 4){
      data.deck = [...deck]
      shuffle(data.deck)
      console.log('Refreshing deck!')
      io.emit('broadcastmsg', "Refreshing deck!")
    }
    
    if (data['turn'] == socket.id) {
      let handPlayer = players[data['turn']]['hand'];
      let playedColor = cardColor(res);
      let playedNumber = res % 14;
      
      let boardColor = cardColor(data['cardOnBoard']);
      let boardNumber = data['cardOnBoard'] % 14;
      
      // console.log(res)
      // console.log(players[socket.id].name, playedColor, playedNumber, boardColor, boardNumber, data.wildcolor)
      
      if (playedColor === 'black' || playedColor === boardColor || playedNumber === boardNumber || playedColor === data.wildcolor) {
        // Play card
        io.emit('sendCard', res);
        data['cardOnBoard'] = res;
        // Remove card
        let cardPos = handPlayer.indexOf(res);
        //change canvas color based on card color
        io.emit('changeColor', baseColors[playedColor]);
        if (cardPos > -1) {
          handPlayer.splice(cardPos, 1);
        }
            io.to(socket.id).emit('haveCard', [handPlayer, null]);
            
            victimid = data["playerids"][Math.abs(data["playerids"].indexOf(data['turn']) + (-1) ** data['reverse']) % data.playerids.length]
            // Next turn
            let skip = 0;
            if (cardType(res) === 'Skip') {
              skip += 1;
            } else if (cardType(res) === 'Reverse') {
              data['reverse'] = (data['reverse'] + 1) % 2;
            } else if (cardType(res) === 'Draw2') {
              skip += 1;
              drawCards(victimid, 2)
              io.emit('broadcastmsg', players[victimid].name + ' drew 2 cards due to ' + players[socket.id].name)
            } else if (cardType(res) === 'Draw4') {
              skip += 1;
              drawCards(victimid, 4)
              io.emit('broadcastmsg', players[victimid].name + ' drew 4 cards due to ' + players[socket.id].name)
              io.to(socket.id).emit('gameStateChange', 'colorpick')
            } else if(cardType(res) === 'Wild') {
              io.to(socket.id).emit('gameStateChange', 'colorpick')
            }
            
            data['turn'] = 
            data.playerids[(data.playerids.length + data["playerids"].indexOf(data['turn']) + (-1) ** data['reverse'] + skip*((-1)**data['reverse'])) % data.playerids.length];
            
            console.log(">> " + players[socket.id].name + ' played ' + cardType(res) + ' ' + cardColors[playedColor] + ' (for '+ cardColors[boardColor] + ' ' + cardType(boardNumber) + ')')
            io.emit('broadcastmsg', players[socket.id].name + ' played ' + cardType(res) + ' ' + cardColors[playedColor] + ' (for '+ cardColors[boardColor] + ' ' + cardType(boardNumber) + ')')
            io.emit('turnPlayer', data['turn']);
            data.wildcolor = null;
            
            // console.log("UNOCLAIM CHEKC:", players[socket.id].hand.length == 1, !players[socket.id].unoclaim)
            if (players[socket.id].hand.length == 1 && !players[socket.id].unoclaim){
              card = drawCards(socket.id, 1)
              console.log('>> ' + players[socket.id].name +' draws ' + cardType(card) + ' ' + cardColor(card));
              io.emit('broadcastmsg', players[socket.id].name + ' drew 1 cards as penalty for not UNOing.')
            } else if (players[socket.id].hand.length > 1 && players[socket.id].unoclaim){
              card = drawCards(socket.id, 1)
              console.log('>> ' + players[socket.id].name +' draws ' + cardType(card) + ' ' + cardColor(card));
              io.emit('broadcastmsg', players[socket.id].name + ' drew 1 cards as penalty for false UNOing.')
              players[socket.id].unoclaim = false
            } else if (players[socket.id].hand.length == 1 && players[socket.id].unoclaim){
              players[socket.id].unoclaim = false
            }
            
            if (players[socket.id].hand.length == 0){
              io.emit('anounceWinner', players[socket.id].name)
              console.log(players[socket.id].name +  " wins this round.")
              data['playing'] = false
              data['deck'] = [];
              data['reverse'] = 0;
              data['turn'] = 0;
              data['cardOnBoard'] = 0;
              for (i in data.playerids){
                players[data.playerids[i]].ready = false
                players[data.playerids[i]].hand = []
              }
              io.emit('getreadyfornewgame')
            }
          }
        }
  });
  
  socket.on('setwildcolor', (chosencolor) => {
    io.emit('broadcastmsg', players[socket.id].name + " chose " + chosencolor + " with wild card")
    io.emit('changeColor', baseColors[chosencolor]);
    data.wildcolor = chosencolor
  })
        
  socket.on('requestInfo', () => {
    if (data.playerids.length !== 0){
      let people = data.playerids.length
      let playernames = []
      let nofcards = []
      let curturn = []
      // console.log(data)
      // console.log(socket.id)
      let unoclm = false
      for (i in data.playerids){
        playernames.push(players[data.playerids[i]].name)
        nofcards.push(players[data.playerids[i]].hand.length)
        curturn.push(data.playerids[i] == data.turn)
      }
      if (players[socket.id]){
        unoclm = players[socket.id].unoclaim
      } else {
        // console.log('this happened', players[socket.id])
        return
      }
      // console.log('info')
      io.to(socket.id).emit('responseInfo', {people, maxPeople, playernames, nofcards, curturn, unoclm})
    } else {
      io.emit('gameStateChange', 'preround')
      data.playing = false;
    }
  })

  setInterval(() => {
    if (!data.playerids.length){
      data.playing = false;
    }
  }, 5000);
}

function shuffle(deck) {
console.log("Shuffling...")
let j, x, i;
for (i = deck.length - 1; i > 0; i--) {
j = Math.floor(Math.random() * (i + 1));
x = deck[i];
deck[i] = deck[j];
deck[j] = x;
}}
  
function cardColor(num) {
  let color;
  if (num % 14 === 13) {
    return 'black';
  }
  switch (Math.floor(num / 14)) {
    case 0:
    case 4:
      color = 'red';
      break;
    case 1:
    case 5:
      color = 'yellow';
      break;
    case 2:
    case 6:
      color = 'green';
      break;
    case 3:
    case 7:
      color = 'blue';
      break;
  }
  return color;
}

function cardType(num) {
  switch (num % 14) {
    case 10: //Skip
      return 'Skip';
    case 11: //Reverse
      return 'Reverse';
    case 12: //Draw 2
      return 'Draw2';
    case 13: //Wild or Wild Draw 4
      if (Math.floor(num / 14) >= 4) {
        return 'Draw4';
      } else {
        return 'Wild';
      }
    default:
      return (num % 14);
      // return 'Number ' + (num % 14);
  }
}

function cardScore(num) {
  let points;
  switch (num % 14) {
    case 10: //Skip
    case 11: //Reverse
    case 12: //Draw 2
      points = 20;
      break;
    case 13: //Wild or Wild Draw 4
      points = 50;
      break;
    default:
      points = num % 14;
      break;
  }
  return points;
}

function checkReady(){
  let ret = true
  for (let i in data["playerids"]){
      if (players[data["playerids"][i]]){
        if (!players[data["playerids"][i]]['ready']){
          ret = false
          console.log(players[data["playerids"][i]].name + ' is NOT READY')
        } else {
          console.log(players[data["playerids"][i]].name + ' is READY')
        }
      }
  }
  return ret
}

function getPlayerIDs(){
  let tempids = Array.from(io.sockets.adapter.sids.keys())
  let playerskeys = Object.keys(players)
  let pids = []
  for (let i in tempids){
    if (playerskeys.includes(tempids[i])){
      pids.push(tempids[i])
    }
  }
  console.log('getPlayerIDs() : ', pids)
  return pids
}

function isPlayable(card){
  let cardcolor = cardColor(card)
  let cardnum = card%14
  let boardColor = cardColor(data['cardOnBoard']);
  let boardNumber = data['cardOnBoard'] % 14;
  if (cardcolor === 'black' || cardcolor === boardColor || cardnum === boardNumber || cardcolor === data.wildcolor) {
    return true;
  }
  return false;
}

function guidGenerator() {
  var S4 = function() {
     return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
  };
  return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}

function drawCards(id, numCards){
  let card;
  let newcards = []
  for (let i=0; i < numCards; i++){
    card = parseInt(data.deck.shift());
    players[id]['hand'].push(card);
    console.log('>> ' + players[id].name +' draws ' + cardType(card) + ' ' + cardColor(card));
    newcards.push(card)
  }
  io.to(id).emit('haveCard', [players[id]['hand'], newcards]);
  return newcards
}