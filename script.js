import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

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
const MAX_CELL = 86;

// سلالم وثعابين (يمكن تعديلها)
const ladders = { 4: 14, 9: 31, 20: 38, 28: 84, 40: 59, 63: 81 };
const snakes = { 17: 7, 54: 34, 62: 19, 71: 50 };

// عناصر DOM
const authScreen = document.getElementById('auth-screen');
const mainScreen = document.getElementById('main-screen');
const gameScreen = document.getElementById('game-screen');
const displayNameSpan = document.getElementById('display-name');
const friendsList = document.getElementById('friends');
const loginError = document.getElementById('login-error');
const signupError = document.getElementById('signup-error');

// مراقبة حالة المصادقة (نفس السابق)
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
    gameScreen.classList.remove('active');
    authScreen.classList.add('active');
    showTab('login');
  }
});

// دوال المصادقة والأصدقاء (كما هي) - تم حذفها للاختصار ولكن يجب تضمينها كاملة من الرد السابق
// ... (نفس الدوال السابقة)

// لاحظ: يجب إضافة دوال showTab, signup, login, logout, loadFriends, addFriend, removeFriend هنا كما كانت سابقاً.

// بدء اللعبة (مباشرة)
window.startGame = function() {
  mainScreen.classList.remove('active');
  gameScreen.classList.add('active');
  
  const user = auth.currentUser;
  if (!user) return;
  
  getDoc(doc(db, 'users', user.uid)).then(userDoc => {
    const username = userDoc.exists() ? userDoc.data().username : user.email;
    
    players = [
      { name: username, position: 1, piece: '🔴', uid: user.uid },
      { name: 'صديق 1', position: 1, piece: '🔵', uid: 'friend1' },
      { name: 'صديق 2', position: 1, piece: '🟢', uid: 'friend2' },
      { name: 'صديق 3', position: 1, piece: '🟡', uid: 'friend3' }
    ];
    
    createBoard();
    initializeGame();
  });
};

// إنشاء اللوحة بشكل متعرج (6 أعمدة، 15 صفاً، آخر صف ناقص)
function createBoard() {
  const boardDiv = document.getElementById('board');
  boardDiv.innerHTML = '';
  
  // تحديد عدد الصفوف (15 صفاً، الصف الأخير به 5 خانات فقط)
  const rows = 15;
  const cols = 6;
  
  // توليد مصفوفة الأرقام من 1 إلى 86
  let numbers = [];
  for (let i = 1; i <= MAX_CELL; i++) numbers.push(i);
  
  // ترتيب الأرقام حسب المسار المتعرج (نبدأ من الصف الأخير إلى الأول)
  // الصفوف من الأسفل إلى الأعلى: الصف 14 (السفلي) إلى الصف 0 (العلوي)
  for (let row = rows - 1; row >= 0; row--) {
    // تحديد الأرقام لهذا الصف
    let rowNumbers = [];
    for (let col = 0; col < cols; col++) {
      if (numbers.length > 0) {
        rowNumbers.push(numbers.shift()); // نأخذ الأرقام بالترتيب التصاعدي
      } else {
        rowNumbers.push(null); // خلية فارغة
      }
    }
    
    // إذا كان الصف زوجياً (من الأسفل) نعكس الترتيب لنحصل على التعرج
    // الصف 14 (الأخير) زوجي: يجب أن يكون 1 2 3 4 5 6 من اليسار؟ لكن في الصورة START في الأسفل يساراً، ثم 2،3،4،5،6 على اليمين.
    // لنعكس حسب الحاجة.
    // الصفوف الزوجية (14,12,10,...) نعكسها لنحصل على الترتيب من اليمين لليسار.
    if (row % 2 === 0) {
      rowNumbers.reverse();
    }
    
    // إضافة الخلايا إلى اللوحة
    rowNumbers.forEach(num => {
      if (num !== null) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        if (num === 1) cell.classList.add('start');
        cell.id = `cell-${num}`;
        cell.textContent = num;
        boardDiv.appendChild(cell);
      } else {
        // خلية فارغة (للصف الأخير الناقص)
        const emptyCell = document.createElement('div');
        emptyCell.classList.add('cell');
        emptyCell.style.background = 'transparent';
        emptyCell.style.boxShadow = 'none';
        boardDiv.appendChild(emptyCell);
      }
    });
  }
}

// باقي دوال اللعبة (initializeGame, updateBoard, updateStatus, rollDice, resetGame, leaveGame) كما كانت سابقاً.
// ... (نفس الدوال السابقة)
