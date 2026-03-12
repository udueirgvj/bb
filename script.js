import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// إعداد Firebase (استخدم إعدادات مشروعك الخاص)
const firebaseConfig = {
  apiKey: "AIzaSyB6NgRD22IG5l2qQ0O-299N1fOjTPNcVF8",
  authDomain: "tbbbbt-90f6e.firebaseapp.com",
  projectId: "tbbbbt-90f6e",
  storageBucket: "tbbbbt-90f6e.firebasestorage.app",
  messagingSenderId: "65865503138",
  appId: "1:65865503138:web:e333233453b4e77a2322fb",
  measurementId: "G-GN9Q84ZMGK"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// متغيرات اللعبة
let players = [];
let currentPlayerIndex = 0;
let gameTimer = null;
const MAX_CELL = 86;

// سلالم وثعابين بسيطة
const ladders = { 4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 63: 81 };
const snakes = { 17: 7, 54: 34, 62: 19, 71: 50, 87: 36, 93: 73, 95: 75, 98: 79 };

// عناصر DOM
const authScreen = document.getElementById('auth-screen');
const mainScreen = document.getElementById('main-screen');
const waitingScreen = document.getElementById('waiting-screen');
const gameScreen = document.getElementById('game-screen');
const displayNameSpan = document.getElementById('display-name');
const friendsList = document.getElementById('friends');
const loginError = document.getElementById('login-error');
const signupError = document.getElementById('signup-error');

// مراقبة حالة المصادقة
onAuthStateChanged(auth, async (user) => {
  if (user) {
    authScreen.classList.remove('active');
    mainScreen.classList.add('active');
    
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      displayNameSpan.textContent = userData.username || user.email;
      loadFriends(userData.friends || []);
    } else {
      await setDoc(doc(db, 'users', user.uid), {
        username: user.email.split('@')[0],
        email: user.email,
        friends: []
      });
      displayNameSpan.textContent = user.email.split('@')[0];
      loadFriends([]);
    }
  } else {
    mainScreen.classList.remove('active');
    waitingScreen.classList.remove('active');
    gameScreen.classList.remove('active');
    authScreen.classList.add('active');
    showTab('login');
  }
});

// تبديل التبويب
window.showTab = function(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  if (tab === 'login') {
    document.querySelector('.tab-btn[onclick="showTab(\'login\')"]').classList.add('active');
    document.getElementById('login-form').style.display = 'flex';
    document.getElementById('signup-form').style.display = 'none';
  } else {
    document.querySelector('.tab-btn[onclick="showTab(\'signup\')"]').classList.add('active');
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('signup-form').style.display = 'flex';
  }
};

// إنشاء حساب
window.signup = async function() {
  const username = document.getElementById('signup-username').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  
  if (!username || !email || !password) {
    signupError.textContent = 'جميع الحقول مطلوبة';
    return;
  }
  
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await setDoc(doc(db, 'users', user.uid), {
      username: username,
      email: email,
      friends: []
    });
    signupError.textContent = '';
  } catch (error) {
    signupError.textContent = error.message;
  }
};

// تسجيل الدخول
window.login = async function() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  
  if (!email || !password) {
    loginError.textContent = 'البريد الإلكتروني وكلمة المرور مطلوبان';
    return;
  }
  
  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginError.textContent = '';
  } catch (error) {
    loginError.textContent = error.message;
  }
};

// تسجيل الخروج
window.logout = async function() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('خطأ في تسجيل الخروج:', error);
  }
};

// تحميل قائمة الأصدقاء
async function loadFriends(friendIds) {
  friendsList.innerHTML = '';
  for (let friendId of friendIds) {
    try {
      const friendDoc = await getDoc(doc(db, 'users', friendId));
      if (friendDoc.exists()) {
        const friendData = friendDoc.data();
        const li = document.createElement('li');
        li.textContent = friendData.username || friendData.email;
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '❌';
        removeBtn.onclick = () => removeFriend(friendId);
        li.appendChild(removeBtn);
        friendsList.appendChild(li);
      }
    } catch (e) {
      console.error('خطأ في تحميل الصديق:', e);
    }
  }
}

// إضافة صديق
window.addFriend = async function() {
  const friendEmail = document.getElementById('friend-email').value.trim();
  if (!friendEmail) return;
  
  const user = auth.currentUser;
  if (!user) return;
  
  try {
    const q = query(collection(db, 'users'), where('email', '==', friendEmail));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      alert('لم يتم العثور على مستخدم بهذا البريد');
      return;
    }
    
    const friendDoc = querySnapshot.docs[0];
    const friendId = friendDoc.id;
    
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      friends: arrayUnion(friendId)
    });
    
    document.getElementById('friend-email').value = '';
    const updatedUser = await getDoc(userRef);
    loadFriends(updatedUser.data().friends || []);
  } catch (error) {
    console.error('خطأ في إضافة صديق:', error);
    alert('حدث خطأ أثناء الإضافة');
  }
};

// إزالة صديق
async function removeFriend(friendId) {
  const user = auth.currentUser;
  if (!user) return;
  
  try {
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      friends: arrayRemove(friendId)
    });
    
    const updatedUser = await getDoc(userRef);
    loadFriends(updatedUser.data().friends || []);
  } catch (error) {
    console.error('خطأ في إزالة صديق:', error);
  }
}

// بدء اللعبة (الانتقال إلى غرفة الانتظار)
window.startGame = function() {
  mainScreen.classList.remove('active');
  waitingScreen.classList.add('active');
  
  const user = auth.currentUser;
  if (!user) return;
  
  getDoc(doc(db, 'users', user.uid)).then(userDoc => {
    const username = userDoc.exists() ? userDoc.data().username : user.email;
    
    // 4 لاعبين: المستخدم الحالي و3 أصدقاء افتراضيين
    players = [
      { name: username, position: 1, piece: '🔴', uid: user.uid },
      { name: 'صديق 1', position: 1, piece: '🔵', uid: 'friend1' },
      { name: 'صديق 2', position: 1, piece: '🟢', uid: 'friend2' },
      { name: 'صديق 3', position: 1, piece: '🟡', uid: 'friend3' }
    ];
    
    displayPlayers(players);
    
    // عد تنازلي 10 ثوانٍ
    let timeLeft = 10;
    const timerSpan = document.getElementById('timer');
    timerSpan.textContent = timeLeft;
    
    if (gameTimer) clearInterval(gameTimer);
    gameTimer = setInterval(() => {
      timeLeft--;
      timerSpan.textContent = timeLeft;
      if (timeLeft <= 0) {
        clearInterval(gameTimer);
        // الانتقال إلى اللعبة
        startPlaying();
      }
    }, 1000);
  });
};

// عرض اللاعبين في غرفة الانتظار
function displayPlayers(playersArray) {
  const listDiv = document.getElementById('players-list');
  listDiv.innerHTML = '';
  playersArray.forEach(p => {
    const div = document.createElement('div');
    div.classList.add('player-icon');
    div.textContent = p.piece + ' ' + p.name;
    listDiv.appendChild(div);
  });
}

// بدء اللعبة فعلياً
function startPlaying() {
  waitingScreen.classList.remove('active');
  gameScreen.classList.add('active');
  
  createBoard();       // إنشاء اللوحة
  initializeGame();    // تهيئة مواقع اللاعبين
}

// إنشاء لوحة بسيطة من 1 إلى 86
function createBoard() {
  const boardDiv = document.getElementById('board');
  boardDiv.innerHTML = '';
  // استخدام grid بسيط: 10 أعمدة (يمكن تعديلها)
  boardDiv.style.gridTemplateColumns = 'repeat(10, 1fr)';
  
  for (let i = 1; i <= MAX_CELL; i++) {
    const cell = document.createElement('div');
    cell.classList.add('cell');
    cell.id = `cell-${i}`;
    cell.textContent = i;
    
    // تمييز خانة البداية
    if (i === 1) {
      cell.style.background = '#fefcbf';
      cell.style.border = '2px solid #d69e2e';
      cell.setAttribute('data-start', 'START');
      // إضافة نص START صغير
      const startLabel = document.createElement('span');
      startLabel.textContent = 'START';
      startLabel.style.position = 'absolute';
      startLabel.style.bottom = '-15px';
      startLabel.style.fontSize = '8px';
      startLabel.style.color = '#d69e2e';
      cell.appendChild(startLabel);
      cell.style.position = 'relative';
    }
    
    boardDiv.appendChild(cell);
  }
}

// تهيئة اللعبة
function initializeGame() {
  players.forEach(p => p.position = 1);
  currentPlayerIndex = 0;
  updateBoard();
  updateStatus();
}

// تحديث مواقع القطع
function updateBoard() {
  document.querySelectorAll('.player-piece').forEach(el => el.remove());
  players.forEach(p => {
    const cell = document.getElementById(`cell-${p.position}`);
    if (cell) {
      const pieceSpan = document.createElement('span');
      pieceSpan.classList.add('player-piece');
      pieceSpan.textContent = p.piece;
      cell.appendChild(pieceSpan);
    }
  });
}

// تحديث حالة اللاعبين
function updateStatus() {
  const statusDiv = document.getElementById('players-status');
  statusDiv.innerHTML = '';
  players.forEach((p, index) => {
    const div = document.createElement('div');
    div.textContent = `${p.piece} ${p.name} - المربع ${p.position}`;
    if (index === currentPlayerIndex) {
      div.style.backgroundColor = '#f6ad55';
    }
    statusDiv.appendChild(div);
  });
}

// رمي النرد
window.rollDice = function() {
  const dice = Math.floor(Math.random() * 6) + 1;
  document.getElementById('dice-result').textContent = `🎲 ${dice}`;
  
  const player = players[currentPlayerIndex];
  let newPosition = player.position + dice;
  
  if (newPosition > MAX_CELL) {
    newPosition = player.position; // لا يتجاوز
  }
  
  // تحقق من الثعابين والسلالم
  if (snakes[newPosition]) {
    newPosition = snakes[newPosition];
    alert(`🐍 ثعبان! انتقل إلى ${newPosition}`);
  } else if (ladders[newPosition]) {
    newPosition = ladders[newPosition];
    alert(`🪜 سلم! انتقل إلى ${newPosition}`);
  }
  
  player.position = newPosition;
  updateBoard();
  
  if (newPosition === MAX_CELL) {
    alert(`🎉 ${player.name} فاز باللعبة!`);
    resetGame();
    return;
  }
  
  // التبديل إلى اللاعب التالي
  currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
  updateStatus();
};

// إعادة تعيين اللعبة
function resetGame() {
  players.forEach(p => p.position = 1);
  currentPlayerIndex = 0;
  updateBoard();
  updateStatus();
}

// الخروج من اللعبة
window.leaveGame = function() {
  gameScreen.classList.remove('active');
  mainScreen.classList.add('active');
  if (gameTimer) clearInterval(gameTimer);
};
