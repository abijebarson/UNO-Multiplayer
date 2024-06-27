const socket = io({autoConnect: false});
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');

const cdWidth = 240;
const cdHeight = 360;
const cards = new Image();
const back = new Image();
const fps = 10;

let ingame = false;
let hand = [];
let newcards = null;
let turn;
let playerName;
let playerID;
let resumeid;
let player_num;
let playerready = false;
let unoclaim = false;

let mode = 'preround'
//INFO
let people = 0
let maxPeople = 10
let allPlayerNames = []
let noOfCards = []
let currentTurnArray = [] 

let hovering = -1
let hover = false;
let chosencolor = null
let winner = null;

let cardOnBoard;
let cobColor;
let cobNumber;

let turnmsg = ""
let currentmsg = "Welcome to the game!"
let prevmsg = ""
let prevprevmsg = ""

let baseColors = {
  green: ['#55aa55', '#3b763b'],
  red: ['#ff5555', '#cc4343'],
  blue: ['#4343cc', '#323299'],
  yellow: ['#ffaa00', '#cc8800'],
  black: ['#555555', '#222222']
}
let themecolors = ['#55aa55', '#cc4343']


function init() {
  ctx.font = "12px Arial";
  // canvas.style.backgroundColor = '#bc9420';
  // canvas.style.backgroundColor = '#a7885c';
  canvas.style.backgroundColor = themecolors[0];

  canvas.height = Math.min(Math.max(window.innerHeight, 700), 800);
  cards.src = 'images/deck.svg';
  back.src = 'images/uno.svg';
  
  document.addEventListener('touchstart', onMouseClick, false);
  document.addEventListener('click', onMouseClick, false);
  document.addEventListener('mousemove', onMouseMove, false);
  document.addEventListener('touchmove', onMouseMove, false);
  document.addEventListener('touchstart', onMouseMove, false);

  for (let id = 0; id < 30; id++){
    let myhtmlrow = document.getElementById('playertable').insertRow(-1)
    myhtmlrow.setAttribute("id", "r"+id)
    myhtmlrow.insertCell(0)
    myhtmlrow.insertCell(1)
  }
  
  playerName = getCookie('playerName');
  if (playerName == null) {
    let defaultName = 'Player' + Math.floor(1000 + Math.random() * 9000);
    playerName = prompt('Enter your name: ', defaultName);
    if (playerName === null || playerName === "") {
      playerName = defaultName;
    } else {
      setCookie('playerName', playerName, 24 * 3600);
    }
  }
  
  resumeid = getCookie('resumeid');
  socket.connect();
  
  startAnimating(fps);
}

function setCookie(name, value, seconds) {
  let date = new Date();
  date.setTime(date.getTime() + (seconds * 1000));
  let expires = "expires=" + date.toUTCString();
  document.cookie = name + "=" + value + ";" + expires + ";path=/; SameSite=Strict";
}

function getCookie(name) {
  name += "=";
  let cookies = document.cookie.split(';');
  for(let i = 0; i < cookies.length; i++) {
    let cookie = cookies[i];
    while (cookie.charAt(0) === ' ') {
      cookie = cookie.substring(1);
    }
    if (cookie.indexOf(name) === 0) {
      return cookie.substring(name.length, cookie.length);
    }
  }
  return null;
}

socket.on('connect', requestGame);
socket.on('confirmLeave', requestGame);

function requestGame() {
  console.log('Resuming with id: ', resumeid)
  socket.emit('requestCurrentGame', resumeid);
}

socket.on('recoveryFeedback', (response) => {
  console.log("Current ID: ", socket.id)
  console.log("Recovery Feedback: ", response)
  if (response[0] == 'success'){
    console.log('player reconnected')
    hand = response[1].hand
    ingame = true
    playerID = socket.id
    mode = 'play'
    setCookie('resumeid', socket.id, 10 * 60);
  }else{
    socket.emit('requestNewGame', playerName);
    hand = [];
    turn = false;
    console.log('>> Game Request', playerName);
    mode = 'preround'
  }
})

socket.on('joiningGame', function (response) {
  console.log('<< Game Response: ', response);
  if (response == 'success') {
    playerID = socket.id
    console.log(playerID)
    setCookie('resumeid', socket.id, 10 * 60);
    ingame = true;
  } else if (response == 'duplicate'){
    console.log('!!: Duplicate connection attempted.')
  } else {
    ingame = false;
    socket.disconnect();
  }
});

socket.on('gameStateChange', function(state) {
  mode = state;
});

socket.on('anounceWinner', function(w) {
  mode = 'win';
  winner = w
});

socket.on('playerDisconnect', function() {
  //ctx.clearRect(0, 0, canvas.width, canvas.height);
  setCookie('resumeid', socket.id, 10 * 60);
  console.log('<< Player disconnected');
});

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

function onMouseClick(e) {

  const offsetY = parseInt(window.getComputedStyle(canvas).marginTop);
  const offsetX = parseInt(window.getComputedStyle(canvas).marginLeft);
  const X = e.pageX - offsetX;
  const Y = e.pageY - offsetY;
  
  
  if ((mode === "preround" || mode === "win") && (Y >= (canvas.height/2)+50) && (Y <= (canvas.height/2)+100) && (X >= canvas.width/2 - 50) && (X <= (canvas.width / 2)+50)){
    // canvas.width / 2 - 50, canvas.height / 2 + 50, 100, 50
    socket.emit('readypressed', playerName);
    playerready = true;
    // console.log('inside')
    return;
  } else if (mode == "play"){
    let lastCard = (hand.length/112)*(cdWidth/3)+(canvas.width/(2+(hand.length-1)))*(hand.length)-(cdWidth/4)+cdWidth/2;
    let initCard = 2 + (hand.length/112)*(cdWidth/3)+(canvas.width/(2+(hand.length-1)))-(cdWidth/4);
    
    if (Y >= canvas.height - cdWidth - canvas.height/100 
      && Y <= canvas.height - cdWidth - canvas.height/100+cdHeight/2
       && X >= initCard && X <= lastCard) {
      for (let i = 0, pos = initCard; i < hand.length; i++, pos += canvas.width/(2+(hand.length-1))) {
        if (X >= pos && X <= pos+canvas.width/(2+(hand.length-1))) {
          // debugArea(pos, pos+canvas.width/(2+(hand.length-1)), 400, 580);
          socket.emit('playCard', hand[i]);
          return;
        }
      }
    } else if (X >= 3*canvas.width/4-cdWidth/4 &&  X <= 3*canvas.width/4+cdWidth/4 &&
      Y >= canvas.height/2-cdHeight/4 && Y <= canvas.height/2+cdHeight/4) {
        socket.emit('drawCard');
      }
      
      let cx = canvas.width / 4;
      let cy = canvas.height / 2;
      let r = cdHeight / 8;
      if ((X-cx)*(X-cx) + (Y-cy)*(Y-cy) <= r*r){
        socket.emit('claimUNO')
      }
  } else if (mode == "colorpick"){
    let cx = canvas.width / 2;
    let cy = canvas.height / 2;
    let r = cdHeight  * 0.7;

    if ((X-cx)*(X-cx) + (Y-cy)*(Y-cy) <= r*r){
      if ((X-cx) > 0 && (Y-cy) > 0){
        chosencolor = 'red'
      } else if ((X-cx) < 0 && (Y-cy) > 0){
        chosencolor = 'blue'
      } else if ((X-cx) > 0 && (Y-cy) < 0){
        chosencolor = 'yellow'
      } else if ((X-cx) < 0 && (Y-cy) < 0){
        chosencolor = 'green'
      }
    }
  }
}

function onMouseMove (e) {

  const offsetY = parseInt(window.getComputedStyle(canvas).marginTop);
  const offsetX = parseInt(window.getComputedStyle(canvas).marginLeft);
  const X = e.pageX - offsetX;
  const Y = e.pageY - offsetY;
  
  
  if (mode === "preround" && ingame && (Y >= (canvas.height/2)+50) && (Y <= (canvas.height/2)+100) && (X >= canvas.width/2 - 50) && (X <= (canvas.width / 2)+50)){
    // canvas.width / 2 - 50, canvas.height / 2 + 50, 100, 50
    // console.log('inside')
    return;
  }
  
  let lastCard = (hand.length/112)*(cdWidth/3)+(canvas.width/(2+(hand.length-1)))*(hand.length)-(cdWidth/4)+cdWidth/2;
  let initCard = 2 + (hand.length/112)*(cdWidth/3)+(canvas.width/(2+(hand.length-1)))-(cdWidth/4);
  let cx = canvas.width / 4;
  let cy = canvas.height / 2;
  let r = cdHeight / 8;

  // (hand.length/112)*(cdWidth/3)+(canvas.width/(2+(hand.length-1)))*(i+1)-(cdWidth/4),
  //         canvas.height - cdWidth - canvas.height/100 -20*hover,
  //         cdWidth/2,
  //         cdHeight/2-20*hover
  if (Y >= canvas.height - cdWidth - canvas.height/100 
     && Y <= canvas.height - cdWidth - canvas.height/100+cdHeight/2
     && X >= initCard && X <= lastCard) {
    for (let i = 0, pos = initCard; i < hand.length; i++, pos += canvas.width/(2+(hand.length-1))) {
      if (X >= pos && X <= pos+canvas.width/(2+(hand.length-1))) {
        // debugArea(pos, pos+canvas.width/(2+(hand.length-1)), 400, 580);
        hovering = i;
        return;
      }
    }
  } else if (X >= 3*canvas.width/4-cdWidth/4 &&  X <= 3*canvas.width/4+cdWidth/4 &&
    Y >= canvas.height/2-cdHeight/4 && Y <= canvas.height/2+cdHeight/4) {
      hovering = 999
  } else if ((X-cx)*(X-cx) + (Y-cy)*(Y-cy) <= r*r){
    hovering = 998
  }else{
    hovering = -1
  }
}

socket.on('turnPlayer', function(cur_id) {
  if (cur_id === playerID) {
    turn = true;
    console.log('<< Your turn');

    turnmsg = "Your turn"
  } else {
    turn = false;
    console.log('<< Not your turn');
    turnmsg = ""
  }
});

socket.on('haveCard', function([newhand, newcardsarr]) {
  newcards = newcardsarr;
  hand = newhand;
  // console.log('<< Current hand: ', hand);
});

socket.on('sendCard', function(num) {
  cardOnBoard = num
  cobColor = cardColor(num)
  cobNumber = cardType(num%14)
});

socket.on('getreadyfornewgame', () => {
  hand = [];
  turn;
  playerName;
  playerID;
  player_num;
  playerready = false;
  playerready = false
  people = 0
  allPlayerNames = []
  noOfCards = []
  currentTurnArray = [] 
});

socket.on('responseInfo', (res)=>{
  people = res.people
  maxPeople = res.maxPeople
  allPlayerNames = res.playernames
  noOfCards = res.nofcards
  currentTurnArray = res.curturn
  unoclaim = res.unoclm
})

socket.on('broadcastmsg', (msg)=>{
  prevprevmsg = prevmsg
  prevmsg = currentmsg
  currentmsg = msg
})

socket.on('changeColor', (color) => {
  themecolors = color
  canvas.style.backgroundColor = color[0]
  document.body.style.backgroundColor = color[1] 
  // document.style.backgroundColor = color[1] 
})

function debugArea(x1, x2, y1, y2) {
  ctx.beginPath();
  ctx.moveTo(0, y1);
  ctx.lineTo(canvas.width, y1);
  ctx.closePath();
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(0, y2);
  ctx.lineTo(canvas.width, y2);
  ctx.closePath();
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(x1, 0);
  ctx.lineTo(x1, canvas.height);
  ctx.closePath();
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(x2, 0);
  ctx.lineTo(x2, canvas.height);
  ctx.closePath();
  ctx.stroke();
}

function chooseColor() {
  
  let cx = canvas.width / 2;
  let cy = canvas.height / 2;
  let r = cdHeight * 0.7;
  let colors = [baseColors['red'][0], baseColors['blue'][0], baseColors['green'][0], baseColors['yellow'][0]];
  
  shadoWrapper('black', 5, 30, () => {
    for(let i = 0; i < 4; i++) {
      let startAngle = i * Math.PI / 2;
      let endAngle = startAngle + Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = colors[i];
      ctx.fill();
    }
  })
}

function unoButton() {
  
  let cx = canvas.width / 4;
  let cy = canvas.height / 2;
  let r = cdHeight / 6;
  ctx.font = 'normal bold 35px sans-serif';
  
  ctx.beginPath();
  // ctx.moveTo(cx, cy);
  if (hovering == 998){
    r = cdHeight/6 - 5
    ctx.font = 'normal bold 33px sans-serif';
  }  
  ctx.arc(cx, cy, r, 0, 2*Math.PI);
  ctx.fillStyle = '#ff3333';
  shadoWrapper('black', 10, 20, () => {
    ctx.fill();
  })
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 5;
  ctx.stroke()  
  ctx.fillStyle = '#ffddaa';
  ctx.strokeStyle = '#ffddaa';
  if (unoclaim){
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'white';
  }
  ctx.textAlign = 'center';
  ctx.fillText("UNO!", cx, cy);
  ctx.textAlign = 'start';
  ctx.lineWidth = 1;
  ctx.textAlign = 'center';
  ctx.strokeText("UNO!", cx, cy);
}

function dialog(text) {
  const width = 800;
  const height = 250;
  ctx.fillStyle = '#ffaa00';

  shadoWrapper('black', 10, 40, () => {
    ctx.fillRect(canvas.width/2 - width/2, canvas.height/2 - height/2, width, height);
  })
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'normal bold 25px sans-serif';
  shadoWrapper('black', 5, 30, () => {
    ctx.fillText(playerName, canvas.width/2, canvas.height/2 - 50);
    ctx.font = 'normal bold 20px sans-serif';
    ctx.fillText(text, canvas.width/2, canvas.height/2);
  })
  }

function arrangeHand(){
  let ccards = []
  for (let i = 0; i < 4; i++){
    ccards = ccards.concat(hand.filter(card => ((card%14)!==13 && (card >= i*14) && (card < (i+1)*14))).sort((a, b) => a - b))
    ccards = ccards.concat(hand.filter(card => ((card%14)!==13 && (card >= (i+4)*14) && (card < (i+5)*14))).sort((a, b) => a - b))
  }
  let wcards = hand.filter(card => (card%14)===13).sort((a, b) => a - b);
  hand = ccards.concat(wcards)
}

function addButton(buttonText, x, y){
  ctx.fillStyle = '#ff3333'
  ctx.fillRect(x, y, 100, 50);
  ctx.strokeStyle = 'white'
  ctx.strokeRect(x, y, 100, 50);
  ctx.font = 'normal bold 50px sans-serif';
  ctx.fillStyle = 'white';
  ctx.fillText(buttonText, canvas.width / 2, canvas.height / 2 + 75);
}

function game_broadcast() {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = 'white';
  ctx.font = 'normal bold 28px sans-serif';
  shadoWrapper('black', 10, 20, () => {
    ctx.fillText(currentmsg, canvas.width/2, 180);
  })
  
  ctx.fillStyle = '#EFEFEF';
  ctx.font = 'normal bold 23px sans-serif';
  shadoWrapper('black', 7, 20, () => {
    ctx.fillText(prevmsg, canvas.width/2, 140);
  })
  
  ctx.fillStyle = '#DFDFDF';
  ctx.font = 'normal bold 20px sans-serif';
  shadoWrapper('black', 5, 20, () => {
    ctx.fillText(prevprevmsg, canvas.width/2, 110);
  })
  
  if (turnmsg !== ""){
    ctx.fillStyle = baseColors[Object.keys(baseColors)[(Object.keys(baseColors).indexOf(cobColor)+3)%5]][0]
    shadoWrapper('black', 10, 50, () => {
      ctx.fillRect(0, 0, canvas.width, 70);
    })
    ctx.font = 'normal bold 35px sans-serif';
    ctx.fillStyle = 'white';
    shadoWrapper('black', 10, 40, () => {
      ctx.fillText(turnmsg, canvas.width/2, 35);
    })
  }
}

function shadoWrapper(color, intensity, blur, func){
  ctx.save();
  
  ctx.shadowOffsetX = intensity;
  ctx.shadowOffsetY = intensity;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur

  func()

  ctx.restore();
}

// function drawImageWithBorder(img, sx, sy, sw, sh, dx, dy, dw, dh, bordercolor, intensity, blur){
//   ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);

// }

var stop = false;
var frameCount = 0;
// var $results = $("#results");
var fpsInterval, startTime, now, then, elapsed;

function startAnimating(fps) {
  fpsInterval = 1000 / fps;
  then = Date.now();
  startTime = then;
  animate();
}

function animate(){

  requestAnimationFrame(animate);
  now = Date.now();
  elapsed = now - then;
  if (elapsed > fpsInterval) {
    then = now - (elapsed % fpsInterval);

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (ingame){
      socket.emit("requestInfo")
    }
    for (let i = 0; i < maxPeople; i++){
      let myhtmlrow = document.getElementById('r'+i)
      let Cells = myhtmlrow.getElementsByTagName("td"); 
      if (allPlayerNames[i]){
        Cells[0].innerHTML = allPlayerNames[i]
        Cells[1].innerHTML = noOfCards[i]
        myhtmlrow.style.color = 'white'
        if (currentTurnArray[i]){
          myhtmlrow.style.color = 'black'
          myhtmlrow.style.backgroundColor = "white"
        } else if (noOfCards[i] == 1){
          myhtmlrow.style.backgroundColor = "#55aa55"
        } else if (noOfCards[i] == 2){
          myhtmlrow.style.backgroundColor = "#55aa55"
        } else {
          myhtmlrow.style.backgroundColor = "#555555"
        }
      } else {
        Cells[0].innerHTML = ""
        Cells[1].innerHTML = ""
      }
    }

    // setInterval(() => {
      //   console.log(mode)
    // }, 1000);
    if (mode == 'preround' && ingame){
      dialog('Waiting for Players (' + people +'/' + maxPeople + ')');
      
      if (!playerready){
        ctx.fillStyle = '#cc4343';
        shadoWrapper('black', 5, 10, () => {
          ctx.fillRect(canvas.width / 2 - 50, canvas.height / 2 + 50, 100, 50);
        })      
        ctx.fillStyle = 'white';
        ctx.fillText("Ready?", canvas.width / 2, canvas.height / 2 + 75);
      } else {
        ctx.fillStyle = '#3b763b';
      shadoWrapper('black', 1, 10, () => {
        ctx.fillRect(canvas.width / 2 - 50, canvas.height / 2 + 50, 100, 50);
      })      
        ctx.fillStyle = 'white';
          ctx.fillText("Ready!", canvas.width / 2, canvas.height / 2 + 75);
        }
    } else if((mode == 'play' || mode == 'colorpick') && ingame){
      game_broadcast()
      const width = 800;
      const height = 250;
      ctx.clearRect(canvas.width/2 - width/2, canvas.height/2 - height/2, width, height);
      let hoverShadowIntensity = 1
      let hoverShadowColor = "#555555"
      if (hovering == 999){
        hover = true
        shadowIntensity = 10
        hoverShadowColor = "black"
      }

      shadoWrapper("black", 3, 9, () => {ctx.drawImage(back, 0, 0, cdWidth, cdHeight, 3*canvas.width/4-cdWidth/4+5, canvas.height/2-cdHeight/4 + 5, cdWidth/2, cdHeight/2)});
        
      for (let i = 4; i >= 0; i--)
        shadoWrapper( "#555555", 1, 1, () => {ctx.drawImage(back, 0, 0, cdWidth, cdHeight, 3*canvas.width/4-cdWidth/4+i, canvas.height/2-cdHeight/4 + i, cdWidth/2, cdHeight/2)});
      shadoWrapper(hoverShadowColor, hoverShadowIntensity, 1+30*hover, () => {ctx.drawImage(back, 0, 0, cdWidth, cdHeight, 3*canvas.width/4-cdWidth/4 - 20*hover, canvas.height/2-cdHeight/4 - 20*hover, cdWidth/2, cdHeight/2)});
      hover = false

      ctx.font = 'normal bold 50px sans-serif';
      ctx.fillText(playerName, canvas.width/2, canvas.height - 25);
      // addButton("Arrange", 3*canvas.width/4, canvas.height - 25)
      //Hand on screen
      arrangeHand()
      for (let i = 0; i < hand.length; i++) {
        hoverShadowColor = "black"
        if (newcards && newcards.includes(hand[i])){
          hoverShadowColor = "white"
          hover = true
          setTimeout(() => {
            newcards = null
          }, 1000);
        }
        if (hovering == i){
          hover = true
        }
        shadoWrapper(hoverShadowColor, 5, 20+20*hover, () => {ctx.drawImage(
          cards,
          1+cdWidth*(hand[i]%14),
          1+cdHeight*Math.floor(hand[i]/14),
          cdWidth,
          cdHeight,
          (hand.length/112)*(cdWidth/3)+(canvas.width/(2+(hand.length-1)))*(i+1)-(cdWidth/4)  - 10  *hover,
          canvas.height - cdWidth - canvas.height/100 -20*hover,
          cdWidth/2,
          cdHeight/2
        )});
        hover = false;
      }
      //sentcard
      shadoWrapper('black', 2, 6, () => {
        ctx.drawImage(cards, 1+cdWidth*(cardOnBoard%14), 1+cdHeight*Math.floor(cardOnBoard/14), cdWidth, cdHeight, canvas.width/2-cdWidth/4, canvas.height/2-cdHeight/4, cdWidth/2, cdHeight/2);
      })
      unoButton()

      if (mode == 'colorpick'){
        chooseColor()
        if (chosencolor){
          cobColor = chosencolor
          socket.emit('setwildcolor', chosencolor)
          chosencolor = null
          mode = 'play'
        }
      }
    } else if(mode == 'win'){
      dialog(winner+ " won this round! Play another round?")
      if (!playerready){
        ctx.fillStyle = '#cc4343';
        ctx.fillRect(canvas.width / 2 - 50, canvas.height / 2 + 50, 100, 50);
        ctx.fillStyle = 'white';
        ctx.fillText("Ready?", canvas.width / 2, canvas.height / 2 + 75);
      } else {
        ctx.fillStyle = '#3b763b';
        ctx.fillRect(canvas.width / 2 - 50, canvas.height / 2 + 50, 100, 50);
        ctx.fillStyle = 'white';
        ctx.fillText("Ready!", canvas.width / 2, canvas.height / 2 + 75);
      }
    } else {
      dialog('Probably the game has already started. Wait for the server to restart the game.');
    }
  
  }
}

init();