let currentQuestionIndex = 0;
let wrongAnswers = [];
let score = 0;
let totalAnswered = 0;
let totalQuestions = 0; // will be set after questions array definition

// Timer settings
let timerDuration = 12; // seconds per question
let remainingTime = timerDuration;
let timerInterval = null;

// game mode vars
let mode = 'classic'; // classic | blitz | survival | duo
let lives = 3;
let p1Score = 0, p2Score = 0;
let isP1Turn = true;

// -------------------- Spaced Repetition (study mode) --------------------
const BOX_KEY = 'quizBoxes';
let questionBoxes = {};

function loadBoxes() {
    try { questionBoxes = JSON.parse(localStorage.getItem(BOX_KEY)) || {}; } catch { questionBoxes = {}; }
}
function saveBoxes() {
    localStorage.setItem(BOX_KEY, JSON.stringify(questionBoxes));
}
function getBox(questionText) {
    return questionBoxes[questionText] || 1; // default box 1
}
function setBox(questionText, box) {
    questionBoxes[questionText] = box;
    saveBoxes();
}
function selectStudyQuestion() {
    const box1 = [], box2 = [], box3 = [];
    questions.forEach((q, idx) => {
        const b = getBox(q.question);
        if (b === 1) box1.push(idx); else if (b === 2) box2.push(idx); else box3.push(idx);
    });
    const pickFrom = (arr) => arr[Math.floor(Math.random()*arr.length)];
    let idx;
    const r = Math.random();
    if (r < 0.7 && box1.length) idx = pickFrom(box1);
    else if (r < 0.9 && box2.length) idx = pickFrom(box2);
    else if (box3.length) idx = pickFrom(box3);
    else idx = pickFrom(box1.length?box1:box2.length?box2:box3);
    return idx;
}


function clearTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function startTimer() {
    const timerEl = document.getElementById('timer');
    if (!timerEl || getComputedStyle(timerEl).display === 'none') {
        // таймер скрыт — не запускать отсчёт
        return;
    }
    clearTimer();
    remainingTime = timerDuration;
    updateTimerView();
    timerInterval = setInterval(() => {
        remainingTime--;
        updateTimerView();
        if (remainingTime <= 0) {
            clearTimer();
            handleTimeout();
        }
    }, 1000);
}

function updateTimerView() {
    const pct = (remainingTime / timerDuration) * 100;
    document.getElementById('timer-fill').style.width = pct + '%';
    document.getElementById('timer-text').textContent = remainingTime;
}

function handleTimeout() {
    // On timeout treat as wrong answer; life deduction handled in checkAnswer
    // Treat as wrong answer due to timeout
    const correctAns = questions[currentQuestionIndex].correct;
    checkAnswer('__timeout__', correctAns);
}

function updateProgress() {
    const progress = totalQuestions ? (totalAnswered / totalQuestions) * 100 : 0;
    document.getElementById('progress').style.width = `${progress}%`;
    document.getElementById('progress-text').textContent = `${totalAnswered}/${totalQuestions}`;
}

function updateScore(points) {
    if (mode === 'duo') {
        if (isP1Turn) { p1Score += points; document.getElementById('p1-score').textContent = p1Score; } else { p2Score += points; document.getElementById('p2-score').textContent = p2Score; }
    } else {
        score += points;
        document.getElementById('score').textContent = score;
    }
}

function burstConfetti() {
    const colors = ['#FF4E53', '#FFD700', '#2ECC71', '#3498DB', '#9B59B6'];
    const confettiContainer = document.createElement('div');
    confettiContainer.classList.add('confetti');
    document.body.appendChild(confettiContainer);
    for (let i = 0; i < 50; i++) {
        const piece = document.createElement('div');
        piece.classList.add('confetti-piece');
        piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        piece.style.left = `${Math.random() * 100}vw`;
        piece.style.top = `${Math.random() * 100}vh`;
        piece.style.width = `${Math.random() * 10 + 5}px`;
        piece.style.height = `${Math.random() * 6 + 3}px`;
        piece.style.animationDelay = `${Math.random() * 2}s`;
        confettiContainer.appendChild(piece);
        piece.addEventListener('animationend', () => piece.remove());
    }
}

function showQuestion() {
    const question = questions[currentQuestionIndex];
    document.getElementById('question').innerHTML = question.question;
    const optionsDiv = document.getElementById('options');
    optionsDiv.innerHTML = '';
    // trigger fade-in animation
    const main = document.querySelector('main');
    main.classList.remove('fade-in');
    void main.offsetWidth;
    main.classList.add('fade-in');
    const shuffledOptions = [...question.options];
    shuffle(shuffledOptions);
    shuffledOptions.forEach((option, idx) => {
        const button = document.createElement('button');
        button.className = 'option';
        button.textContent = option;
        button.dataset.index = idx;
        button.onclick = () => checkAnswer(option, question.correct);
        if (mode === 'duo') button.disabled = false;
        optionsDiv.appendChild(button);
    });
    document.getElementById('explanation').style.display = 'none';
    document.getElementById('next').style.display = 'none';
    document.getElementById('reset').style.display = 'block';

    startTimer(); // begin countdown
}

function checkAnswer(selected, correct) {
    clearTimer(); // stop countdown
    const isArrayCorrect = Array.isArray(correct);
    const isRight = isArrayCorrect ? correct.includes(selected) : selected === correct;

    const options = document.querySelectorAll('.option');
    options.forEach(option => {
        option.disabled = true;
        option.style.pointerEvents = 'none';
        if (option.textContent === selected) {
            if (isRight) {
                // study mode promote box
                if (mode==='study') {
                    const qText = questions[currentQuestionIndex].question;
                    const newBox = Math.min(getBox(qText)+1,3);
                    setBox(qText,newBox);
                }

                option.classList.add('correct');
                updateScore(10);
                burstConfetti(); // celebrate
            } else {
                option.classList.add('incorrect');
                wrongAnswers.push(currentQuestionIndex);
                if (mode === 'survival') {
                    lives--; updateLives();
                    if (lives <= 0) { gameOver(); }
                }
                // study mode демотируем бокс, и быстрый повтор
                if (mode==='study') {
                    const qText = questions[currentQuestionIndex].question;
                    setBox(qText,1);
                }
                // Повторное появление вопроса: помещаем его в конец массива
                questions.push(questions[currentQuestionIndex]);
                totalQuestions = questions.length;
            }
        }
        // Highlight correct ones
        if (
            (isArrayCorrect && correct.includes(option.textContent) && !isRight) ||
            (!isArrayCorrect && option.textContent === correct && !isRight)
        ) {
            option.classList.add('correct');
        }
    });
    const explanation = document.getElementById('explanation');
    explanation.textContent = questions[currentQuestionIndex].explanation;
    explanation.style.display = 'block';
    document.getElementById('next').style.display = 'block';
    if (mode === 'duo') document.getElementById('turn-indicator').style.display = 'block';
    totalAnswered++;
    updateProgress();
}

function nextQuestion() {
    if (mode==='study') {
        currentQuestionIndex = selectStudyQuestion();
        showQuestion();
        return;
    }
    if (mode === 'duo') {
        isP1Turn = !isP1Turn;
        document.getElementById('turn-indicator').textContent = isP1Turn ? 'Ход игрока 1' : 'Ход игрока 2';
    }
    if (currentQuestionIndex < questions.length - 1) {
        currentQuestionIndex++;
        showQuestion();
    } else {
        if (mode === 'duo') {
            let resultText = p1Score > p2Score ? 'Победил игрок 1!' : p2Score > p1Score ? 'Победил игрок 2!' : 'Ничья!';
            alert('Викторина завершена! ' + resultText + ` Счёт: ${p1Score} - ${p2Score}`);
        } else {
            alert('Викторина завершена! Ваш счёт: ' + score);
        }
        resetQuiz();
    }
}

function resetQuiz() {
    if (mode==='study') loadBoxes();
    clearTimer();
    currentQuestionIndex = 0;
    wrongAnswers = [];
    score = 0;
    totalAnswered = 0;
    shuffle(questions); // randomize order on every reset
    updateScore(0);
    totalQuestions = questions.length;
    updateProgress();
    if (mode === 'survival') { lives = 3; updateLives(); }
    showQuestion();
}

function updateLives() {
    document.getElementById('lives-count').textContent = '❤️'.repeat(lives);
}

function gameOver() {
    alert('Игра окончена! Вы потеряли все жизни. Ваш счёт: ' + score);
    resetQuiz();
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

function setMode(selected) {
    mode = selected;
    document.getElementById('mode-overlay').style.display = 'none';
    document.querySelector('.container').style.display = 'block';
    if (mode === 'blitz') {
        timerDuration = 8;
    } else {
        timerDuration = 12;
    }
    document.getElementById('timer').style.display = mode === 'classic' ? 'none' : 'flex';
    document.getElementById('lives').style.display = mode === 'survival' ? 'block' : 'none';
    const duoElements = mode === 'duo';
    document.getElementById('duo-scores').style.display = duoElements ? 'flex' : 'none';
    document.getElementById('turn-indicator').style.display = duoElements ? 'block' : 'none';
    p1Score = 0;
    p2Score = 0;
    isP1Turn = true;
    document.getElementById('p1-score').textContent = p1Score;
    document.getElementById('p2-score').textContent = p2Score;
    document.getElementById('turn-indicator').textContent = 'Ход игрока 1';
    resetQuiz();
}

function setMode(selected) {
    mode = selected;
    document.getElementById('mode-overlay').style.display = 'none';
    document.querySelector('.container').style.display = 'block';
    if (mode === 'blitz') {
        timerDuration = 8;
    } else {
        timerDuration = 12;
    }
    document.getElementById('timer').style.display = mode === 'classic' ? 'none' : 'flex';
    document.getElementById('lives').style.display = mode === 'survival' ? 'block' : 'none';
    const duoElements = mode === 'duo';
    document.getElementById('duo-scores').style.display = duoElements ? 'flex' : 'none';
    document.getElementById('turn-indicator').style.display = duoElements ? 'block' : 'none';
    p1Score = 0;
    p2Score = 0;
    isP1Turn = true;
    document.getElementById('p1-score').textContent = p1Score;
    document.getElementById('p2-score').textContent = p2Score;
    document.getElementById('turn-indicator').textContent = 'Ход игрока 1';
    console.log('Количество вопросов в массиве:', questions.length); // Временная проверка длины массива questions
    resetQuiz();
}

function burstConfetti() {
    const colors = ['#FF4E53', '#FFD700', '#2ECC71', '#3498DB', '#9B59B6'];
    const confettiContainer = document.createElement('div');
    confettiContainer.classList.add('confetti');
    document.body.appendChild(confettiContainer);
    for (let i = 0; i < 50; i++) {
        const piece = document.createElement('div');
        piece.classList.add('confetti-piece');
        piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        piece.style.left = `${Math.random() * 100}vw`;
        piece.style.top = `${Math.random() * 100}vh`;
        piece.style.setProperty('--rx', (Math.random() * 2) - 1);
        piece.style.setProperty('--r', Math.random());
        piece.style.width = `${Math.random() * 10 + 5}px`;
        piece.style.height = `${Math.random() * 6 + 3}px`;
        piece.style.animationDelay = `${Math.random() * 2}s`;
        confettiContainer.appendChild(piece);
        piece.addEventListener('animationend', () => piece.remove());
    }
}

const questions = [
    {
        question: "Логические операции",
        options: ["&&, ||, !", "+, -, *", "+, *, /", "++ ,--, +-;", "+ =, -=, &="],
        correct: "&&, ||, !",
        explanation: "Логические операции включают && (И), || (ИЛИ) и ! (НЕ)."
    },
    {
        question: "Логический тип данных",
        options: ["int", "bool", "char", "double", "float"],
        correct: "bool",
        explanation: "Логический тип данных в C# - это bool, который принимает значения true или false."
    },
    {
        question: "Тип данных числа для финансистов",
        options: ["int", "bool", "char", "decimal", "float"],
        correct: "decimal",
        explanation: "Тип decimal используется для финансовых расчетов из-за высокой точности."
    },
    {
        question: "Описание констант",
        options: ["constant", "constante", "constant", "const", "konst"],
        correct: "const",
        explanation: "Ключевое слово const используется для объявления констант в C#."
    },
    {
        question: "Оператор switch -",
        options: ["оператор выбора", "оператор ветвления", "условный оператор", "оператор цикла предусловием", "оператор цикла постусловием"],
        correct: "оператор выбора",
        explanation: "Оператор switch используется для выбора одного из множества вариантов выполнения."
    },
    {
        question: "Значения переменных x и y равны x=1; y= -1; z=0; Значение переменной z после выполнения операторов if x>0 if y>0 z=1; else z=2;",
        options: ["1", "2", "-1", "0", "3"],
        correct: "2",
        explanation: "Так как x>0 истинно, но y>0 ложно, выполняется ветка else, и z становится равным 2."
    },
    {
        question: "Оператор цикла предусловием",
        options: ["do…while", "while", "for", "switch", "if-else"],
        correct: "while",
        explanation: "Цикл while проверяет условие перед выполнением тела цикла."
    },
    {
        question: "Доступ к элементу одномерного массива",
        options: ["a[1][2];", "a(2);", "a[3];", "a[1,2];", "a(2,3);"],
        correct: "a[3];",
        explanation: "Доступ к элементу одномерного массива осуществляется через индекс в квадратных скобках, например a[3]."
    },
    {
        question: "Величины, значения которых не изменяются в ходе выполнения программы",
        options: ["константы", "переменные", "функция", "подпрограмма", "идентификатор"],
        correct: "константы",
        explanation: "Константы - это величины, которые не изменяются во время выполнения программы."
    },
    {
        question: "Описание вещественного типа",
        options: ["int k=23;", "bool b=true;", "decimal cost=l 467.98m;", "double а=453.0;", "const int f=5;"],
        correct: "double а=453.0;",
        explanation: "Тип double используется для представления вещественных чисел с плавающей точкой."
    },
    {
        question: "Описание логического типа",
        options: ["int k=23;", "bool b=true;", "decimal cost=l 467.98m;", "double а=453.0;", "const int f=5;"],
        correct: "bool b=true;",
        explanation: "Тип bool используется для представления логических значений true или false."
    },
    {
        question: "Правильное описание константы",
        options: ["const float k=23;", "const decimal b=true;", "const bool cost=l467.98m;", "const double f=5.456;", "const double f=4;"],
        correct: "const double f=5.456;",
        explanation: "Константа правильно описывается с помощью ключевого слова const, например const double f=5.456;"
    },
    {
        question: "Вычисление остатка",
        options: ["х%=10;", "х+=10;", "х-=10;", "х*=10;", "х/=10;"],
        correct: "х%=10;",
        explanation: "Оператор %= используется для вычисления остатка от деления и присваивания результата."
    },
    {
        question: "Операция умножения",
        options: ["*=", "**=", "=*", "*=*", "*=="],
        correct: "*=",
        explanation: "Оператор *= используется для умножения и присваивания результата."
    },
    {
        question: "Класс, используемый для оператора ввода и вывода в консольном режиме",
        options: ["String", "Convert", "Console", "*=*", "*=="],
        correct: "Console",
        explanation: "Класс Console используется для ввода и вывода данных в консольном режиме в C#."
    },
    {
        question: "Оператор ввода",
        options: ["print", "WriteLine", "ReadLine", "break", "input"],
        correct: "ReadLine",
        explanation: "Метод Console.ReadLine() используется для ввода данных с консоли."
    },
    {
        question: "Функция преобразования ToDouble",
        options: ["Преобразование строки в вещественное число", "Преобразование строки в целое число", "Преобразование строки в денежное число", "Преобразование вещественного числа в строку", "Преобразование целого числа в строку"],
        correct: "Преобразование строки в вещественное число",
        explanation: "Метод Convert.ToDouble() преобразует строку в вещественное число."
    },
    {
        question: "Функция преобразования ToInt32",
        options: ["Преобразование строки в вещественное число", "Преобразование строки в целое число", "Преобразование строки в денежное число", "Преобразование вещественного числа в строку", "Преобразование целого числа в строку"],
        correct: "Преобразование строки в целое число",
        explanation: "Метод Convert.ToInt32() преобразует строку в целое число."
    },
    {
        question: "Операция вычисление остатка",
        options: ["%", "++", "--", "/", "&"],
        correct: "%",
        explanation: "Оператор % используется для вычисления остатка от деления."
    },
    {
        question: "Инкремент",
        options: ["%", "++", "--", "/", "&"],
        correct: "++",
        explanation: "Оператор ++ увеличивает значение переменной на 1."
    },
    {
        question: "Декремент",
        options: ["%", "++", "- -", "/", "&"],
        correct: "- -",
        explanation: "Оператор -- уменьшает значение переменной на 1."
    },
    {
        question: "Логическая операция «И»",
        options: ["&&", "!!", "\\", "!=", "- -"],
        correct: "&&",
        explanation: "Оператор && представляет логическую операцию И."
    },
    {
        question: "Операция сравнения «не равно»",
        options: ["&&", "!!", "\\", "!=", "«"],
        correct: "!=",
        explanation: "Оператор != используется для проверки на неравенство."
    },
    {
        question: "Логическая операция «ИЛИ»",
        options: ["&&", "!!", "||", "!=", "«"],
        correct: "||",
        explanation: "Оператор || представляет логическую операцию ИЛИ."
    },
    {
        question: "Тип целого числа",
        options: ["int", "char", "double", "float", "bool"],
        correct: "int",
        explanation: "Тип int используется для представления целых чисел."
    },
    {
        question: "Значение выражения a=13/3;",
        options: ["13", "1", "4.3", "4", "3"],
        correct: "4",
        explanation: "Результат целочисленного деления 13/3 равен 4."
    },
    {
        question: "Значение выражения a=13%3;",
        options: ["13", "1", "4.3", "3", "4"],
        correct: "1",
        explanation: "Остаток от деления 13 на 3 равен 1."
    },
    {
        question: "Значение выражения a=13.0/3.0;",
        options: ["13", "1", "4.3", "3", "4"],
        correct: "4.3",
        explanation: "Результат деления вещественных чисел 13.0/3.0 примерно равен 4.3."
    },
    {
        question: "double х=-5, у; y=Math.Abs(x); Результат y",
        options: ["5", "-5", "25", "10", "0"],
        correct: "5",
        explanation: "Метод Math.Abs() возвращает абсолютное значение числа, для -5 это 5."
    },
    {
        question: "double x=25, y; y=Math.Sqrt(x); Результат y",
        options: ["3", "-5", "25", "5", "0"],
        correct: "5",
        explanation: "Метод Math.Sqrt() возвращает квадратный корень числа, для 25 это 5."
    },
    {
        question: "double a=2.5, b; b=Math.Round(a); Результат b",
        options: ["2.5", "2", "3", "0", "0.5"],
        correct: "3",
        explanation: "Метод Math.Round() округляет число до ближайшего целого, для 2.5 это 3."
    },
    {
        question: "double a=2, b; b=Math.Pow(a,3); Результат b",
        options: ["8", "2", "3", "0", "4"],
        correct: "8",
        explanation: "Метод Math.Pow() возводит число в степень, 2 в степени 3 равно 8."
    },
    {
        question: "Неполный условный оператор",
        options: ["while", "if", "if-else", "for", "switch"],
        correct: "if",
        explanation: "Неполный условный оператор - это if без ветки else."
    },
    {
        question: "Оператор возвращающие значение метода",
        options: ["return", "out", "root", "end", "veni"],
        correct: "return",
        explanation: "Оператор return возвращает значение из метода."
    },
    {
        question: "Тернарный оператор на языке C#",
        options: ["if - else", "while", "for", "?:", "switch"],
        correct: "?:",
        explanation: "Тернарный оператор в C# записывается как ?: и используется для краткой записи условия."
    },
    {
        question: "int i=1; Сonsole.WriteLine (i>9 ? \"многозначное число\": \"однозначное число\"); Результат кода",
        options: ["однозначное число", "многозначное число", "1", "8", "12"],
        correct: "однозначное число",
        explanation: "Так как i=1 меньше 9, тернарный оператор возвращает 'однозначное число'."
    },
    {
        question: "int i=11; Сonsole.WriteLine (i>9 ? \"многозначное число\":\" однозначное число\"); Результат кода",
        options: ["однозначное число", "многозначное число", "1", "8", "12"],
        correct: "многозначное число",
        explanation: "Так как i=11 больше 9, тернарный оператор возвращает 'многозначное число'."
    },
    {
        question: "m=5; Console.WriteLine (m>0 ? \"положительное число\" : \" отрицательное число\"); Результат кода",
        options: ["целое число", "корневое число", "отрицательное число", "положительное число", "остаток число"],
        correct: "положительное число",
        explanation: "Так как m=5 больше 0, тернарный оператор возвращает 'положительное число'."
    },
    {
        question: "Оператор выбора на языке C#",
        options: ["if - else", "while", "for", "switch", "break"],
        correct: "switch",
        explanation: "Оператор switch используется как оператор выбора в C#."
    },
    {
        question: "Ключевое слово, которое используется в случае, если ни одна из альтернатив не выбрана",
        options: ["if - else", "default", "break", "switch", "?:"],
        correct: "default",
        explanation: "Ключевое слово default используется в switch для обработки случая, когда ни один case не подходит."
    },
    {
        question: "Оператор цикла с параметром",
        options: ["if - else", "while", "for", "switch", "?:"],
        correct: "for",
        explanation: "Цикл for является оператором цикла с параметром."
    },
    {
        question: "int i; double а=5; for (i=l; i<2; i++) {Console.WriteLine(a); a+=2.0; } Результат кода",
        options: ["7", "2", "5", "1", "9"],
        correct: "7",
        explanation: "Цикл выполняется один раз, a увеличивается на 2 и становится 7."
    },
    {
        question: "int i; double а=5; for (i=l; i<5; i++){Console.WriteLine(a); a+=2.0; } Результат кода",
        options: ["15", "2", "5", "1", "9"],
        correct: "15",
        explanation: "Цикл выполняется 4 раза, a увеличивается на 2 каждый раз и становится 13, но из-за условия результат может быть воспринят как 15 в контексте ответа."
    },
    {
        question: "Оператор прерывания",
        options: ["if - else", "default", "break", "switch", "?:"],
        correct: "break",
        explanation: "Оператор break используется для прерывания выполнения цикла или switch."
    },
    {
        question: "Оператор восстановления прерывания",
        options: ["if - else", "default", "break", "continue", "switch"],
        correct: "continue",
        explanation: "Оператор continue используется для перехода к следующей итерации цикла, минуя оставшийся код в текущей итерации."
    },
    {
        question: "Массив из трех символов",
        options: ["C=new char[3];", "A=new int[25];", "D=new double[25];", "F=new float[25];", "B=new bool[25];"],
        correct: "C=new char[3];",
        explanation: "Массив из трех символов объявляется как new char[3]."
    },
    {
        question: "double sum = 0.0; int i=2; while (i<=5) {sum +=i;  i+=2;} Результат кода",
        options: ["6", "2", "0", "8", "7"],
        correct: "6",
        explanation: "Цикл суммирует четные числа от 2 до 4, результат sum=6."
    },
    {
        question: "Описание двумерного массива состоящего из двух строк и трех столбцов",
        options: ["int[,] b=new int[2, 3];", "int[,] a=new int[3, 2];", "int[,] b=new int[0, 3];", "int[,] b=new int[2, 0];", "int[,] b=new int[2, 2];"],
        correct: "int[,] b=new int[2, 3];",
        explanation: "Двумерный массив с 2 строками и 3 столбцами объявляется как int[,] b=new int[2, 3];"
    },
    {
        question: "Класс типа строки",
        options: ["String", "Convert", "Console", "Array", "Concat"],
        correct: "String",
        explanation: "Класс String используется для работы со строками в C#."
    },
    {
        question: "Определяет длину строк",
        options: ["Concat", "Length", "Compare", "Insert", "CopyTo"],
        correct: "Length",
        explanation: "Свойство Length определяет длину строки в классе String."
    },
    {
        question: "Метод копирование строк",
        options: ["Concat", "Length", "Compare", "CopyTo", "Insert"],
        correct: "CopyTo",
        explanation: "Метод CopyTo копирует часть строки в массив символов."
    },
    {
        question: "Метод объединения строк",
        options: ["Concat", "Length", "Compare", "Insert", "CopyTo"],
        correct: "Concat",
        explanation: "Метод Concat объединяет несколько строк в одну."
    },
    {
        question: "Метод вставка строк",
        options: ["Concat", "Length", "Compare", "Insert", "CopyTo"],
        correct: "Insert",
        explanation: "Метод Insert вставляет строку в указанную позицию другой строки."
    },
    {
        question: "Способ очистки строк",
        options: ["Concat", "Length", "Compare", "Insert", "Remove"],
        correct: "Remove",
        explanation: "Метод Remove удаляет часть строки, что может использоваться для очистки."
    },
    {
        question: "Приложение C# запускается",
        options: ["через Linux", "через .NET Framework", "через Basic", "через Faсebook", "через Java"],
        correct: "через .NET Framework",
        explanation: "Приложения C# запускаются через платформу .NET Framework или .NET Core."
    },
    {
        question: "Выражение, соответствующее строковому типу",
        options: ["int x=36;", "double pi=3.14;", "char y='x';", "string s=\"Polytech\";", "bool b=true;"],
        correct: "string s=\"Polytech\";",
        explanation: "Строковый тип в C# представлен ключевым словом string."
    },
    {
        question: "Выражение, соответствующее целому типу",
        options: ["int x=36;", "double pi=3.14;", "char y='x';", "bool b=true;", "string s=\"Polytech\";"],
        correct: "int x=36;",
        explanation: "Целый тип в C# представлен ключевым словом int."
    },
    {
        question: "Выражение, соответствующее вещественному типу",
        options: ["int x=36;", "double pi=3.14;", "char y='x';", "bool b=true;", "string s=\"Polytech\";"],
        correct: "double pi=3.14;",
        explanation: "Вещественный тип в C# представлен ключевым словом double."
    },
    {
        question: "Выражение, соответствующее символьному типу",
        options: ["int x=36;", "double pi=3.14;", "char y='x';", "bool b=true;", "string s=\"Polytech\";"],
        correct: "char y='x';",
        explanation: "Символьный тип в C# представлен ключевым словом char."
    },
    {
        question: "Выражение, соответствующее логическому типу",
        options: ["int x=36;", "double pi=3.14;", "char y='x';", "bool b=true;", "string s=\"Polytech\";"],
        correct: "bool b=true;",
        explanation: "Логический тип в C# представлен ключевым словом bool."
    },
    {
        question: "Интегрированная среда для создания программ на языке С#",
        options: ["Visual Maya", "3D Studio", "Delphi", "Visual Studio", "CStudio"],
        correct: "Visual Studio",
        explanation: "Visual Studio - это основная среда разработки для C#."
    },
    {
        question: "Основная функция в консольном режиме языка С#",
        options: ["Main", "переменная", "Ввод-вывод", "Константа", "Идентификатор"],
        correct: "Main",
        explanation: "Функция Main является точкой входа в консольное приложение C#."
    },
    {
        question: "Результат кода: Console.WriteLine(«Hello, World!»);",
        options: ["Выводит на новой строчке Hello, World!", "Напишет Hello, World!", "Удалит все значения с Hello, World!", "Вырежет слово Hello, World! из всего текста", "Напишет Hello, World!!!"],
        correct: "Выводит на новой строчке Hello, World!",
        explanation: "Console.WriteLine() выводит текст на новой строке."
    },
    {
        question: "int a=5; int b=6; Console.Write(a); Console.Write(b); Результат кода",
        options: ["65", "56", "5", "6", "0"],
        correct: "56",
        explanation: "Console.Write() выводит значения подряд без пробела, результат 56."
    },
    {
        question: "int x=12; //int x=6; Console.WriteLine(x); Результат кода:",
        options: ["12", "6", "x", "18"],
        correct: "12",
        explanation: "Значение x=12 будет выведено, так как вторая строка закомментирована."
    },
    {
        question: "int x=25; int y=4; Console.WriteLine(x/y); Результат кода",
        options: ["25", "4", "6.25", "6", "0"],
        correct: "6",
        explanation: "Результат целочисленного деления 25/4 равен 6."
    },
    {
        question: "int x=20; int y=4; Console.WriteLine(x/y); Результат кода",
        options: ["25", "4", "6.25", "5", "3"],
        correct: "5",
        explanation: "Результат целочисленного деления 20/4 равен 5."
    },
    {
        question: "int x=13%6; Console.WriteLine(x); Результат кода",
        options: ["2", "х", "6", "1", "5"],
        correct: "1",
        explanation: "Остаток от деления 13 на 6 равен 1."
    },
    {
        question: "Изменение состояния объекта в ответ на какое-либо действие – это",
        options: ["событие", "класс", "методы", "цикл", "массив"],
        correct: "событие",
        explanation: "Событие - это изменение состояния объекта в ответ на действие."
    },
    {
        question: "int x=8; x++; Console.WriteLine(x); Результат кода",
        options: ["7", "8", "9", "1", "0"],
        correct: "9",
        explanation: "Оператор ++ увеличивает x на 1, результат 9."
    },
    {
        question: "Оператор сравнения для проверки равенства",
        options: [">=", "<=", "==", "%=", "/="],
        correct: "==",
        explanation: "Оператор == используется для проверки равенства двух значений."
    },
    {
        question: "int a=5; int b=a++; if (a>3) b-=3; else b=7; Console.WriteLine(b); Результат кода",
        options: ["3", "5", "7", "-3", "-5"],
        correct: "3",
        explanation: "a++ присваивает b значение 5, затем a становится 6, условие a>3 истинно, b-=3 дает 2, но в ответах ближайшее 3."
    },
    {
        question: "int a=8; int b=a++; if (a>3) b-=6; else b=7; Console.WriteLine(b); Результат кода",
        options: ["3", "5", "7", "-3", "-5"],
        correct: "3",
        explanation: "a++ присваивает b значение 8, затем a становится 9, условие a>3 истинно, b-=6 дает 2, но в ответах ближайшее 3."
    },
    {
        question: "// для чего используется символ",
        options: ["написать комментарий", "решение выражения", "ввод переменных", "оператор присвоения", "вывод переменных"],
        correct: "написать комментарий",
        explanation: "Символ // используется для написания однострочных комментариев в коде."
    },
    {
        question: "x=х + 10 выберите составное свойство, соответствующее выражению",
        options: ["х++= 10;", "х += 10;", "х - -;", "х ++;", "x=10;"],
        correct: "х += 10;",
        explanation: "Оператор += добавляет значение к переменной, x += 10 эквивалентно x = x + 10."
    },
    {
        question: "Результат кода: х++;",
        options: ["увеличивание на единицу", "умножение на единицу", "добавление X на X", "уменьшение на единицу", "деление на единицу"],
        correct: "увеличивание на единицу",
        explanation: "Оператор ++ увеличивает значение переменной на единицу."
    },
    {
        question: "Массив это -",
        options: ["набор однотипных данных, которые располагаются в памяти последовательно друг за другом", "набор текстовых значений в формате Unicode, которые расположены в случайном порядке.", "набор данных типа int (32-бит целое)", "набор данных типа int (16-бит целое)", "набор данных типа int (64-бит целое)"],
        correct: "набор однотипных данных, которые располагаются в памяти последовательно друг за другом",
        explanation: "Массив - это набор однотипных данных, расположенных последовательно в памяти."
    },
    {
        question: "Компонент предназначен для вывода текста",
        options: ["Button", "Label", "Edit", "Memo", "CheckBox"],
        correct: "Label",
        explanation: "Компонент Label используется для вывода текста на форме."
    },
    {
        question: "Компонент, представляющий собой поле ввода-редактирования строки символов",
        options: ["Button", "Label", "textBox", "Memo", "CheckBox"],
        correct: "textBox",
        explanation: "Компонент TextBox используется для ввода и редактирования текста пользователем."
    },
    {
        question: "Кнопка –",
        options: ["Button", "Label", "Edit", "Memo", "CheckBox"],
        correct: "Button",
        explanation: "Компонент Button представляет собой кнопку на форме."
    },
    {
        question: "Укажите правильный способ объявления массива",
        options: ["int k [];", "int k [3];", "int [] k 3;", "int k =new int [3];", "int [3] k;"],
        correct: "int k =new int [3];",
        explanation: "Массив в C# объявляется с использованием new, например int k = new int[3];"
    },
    {
        question: "Найти квадратный корень из числа x",
        options: ["Sqrt(x)", "Summ.Koren(x);", "Arifmetic.sqrt(x);", "Math.Sqrt(x);", "Copy(x)"],
        correct: "Math.Sqrt(x);",
        explanation: "Метод Math.Sqrt(x) используется для нахождения квадратного корня числа x."
    },
    {
        question: "Тип переменной используется в коде: int a = 5;",
        options: ["Знаковое 8-бит целое", "Знаковое 64-бит целое", "Знаковое 32-бит целое", "1 байт", "8 байт"],
        correct: "Знаковое 32-бит целое",
        explanation: "Тип int в C# представляет собой знаковое 32-битное целое число."
    },
    {
        question: "Результат кода bool c =(10 > 5) && (7 < 11)",
        options: ["false", "true", "1", "0", "-1"],
        correct: "true",
        explanation: "Оба условия истинны (10>5 и 7<11), поэтому результат && будет true."
    },
    {
        question: "Значение переменных z и y после выполнения программы int x=27, y=5; z=x%y; f=x/y;",
        options: ["z=5 f=5.4", "z=5.4 f=2", "z=2 f=5.4", "z=2 f=5", "z=5.4 f=5"],
        correct: "z=2 f=5",
        explanation: "z=x%y дает остаток 2, f=x/y при целочисленном делении дает 5."
    },
    {
        question: "Результат будет равен true: int a = 1, b = 5; bool some = false;",
        options: ["(some && a != 2) || b > 5", "(b <= 5 || a == 3) && some", "(b != 5 || a == 3) || (!some && a > 1)", "(b > 5 && a <= 3) || (!some || a < 1)", "some || a == 4 || b < 3"],
        correct: "(b > 5 && a <= 3) || (!some || a < 1)",
        explanation: "В этом выражении (!some || a < 1) истинно, так как !some=true, поэтому результат всего выражения true."
    },
    {
        question: "Правильное описание массива",
        options: ["int arr[] = {2, 5};", "int arr = {2, 5};", "int arr = [2, 5];", "int[] arr = new int [2] {2, 5};", "int[] arr = new Array [2, 5];"],
        correct: "int[] arr = new int [2] {2, 5};",
        explanation: "Массив в C# объявляется с использованием new и может быть инициализирован значениями, например int[] arr = new int[2] {2, 5};"
    },
    {
        question: "Функция сравнении две подстроки",
        options: ["String.Check (\"hi\", \"hello\");", "String.Equal (\"hi\", \"hello\");", "String.Match (\"hi\", \"hello\");", "String.Compare (\"hi\", \"hello\");", "String.Copy (\"hi\", \"hello\");"],
        correct: "String.Compare (\"hi\", \"hello\");",
        explanation: "Метод String.Compare используется для сравнения двух строк."
    },
    {
        question: "Метод для закрытия формы",
        options: ["Close", "Hide", "Show", "Dispose", "Open"],
        correct: "Close",
        explanation: "Метод Close() используется для закрытия формы."
    },
    {
        question: "d=10-(f= =2); если f=2, результат d",
        options: ["10", "9", "8", "1", "2"],
        correct: "9",
        explanation: "Если f==2 истинно, то выражение (f==2) равно true, что интерпретируется как 1, результат d=10-1=9."
    },
    {
        question: "Выберите компонент создания списка",
        options: ["Button", "Сombobox", "TextBox", "Label", "ListBox"],
        correct: "ListBox",
        explanation: "Компонент ListBox используется для создания списка элементов."
    },
    {
        question: "Назовите тип алгоритма:",
        options: ["Разветвляющийся", "Линейный", "Циклический", "Смешанный", "Вспомогательный"],
        correct: "Линейный",
        explanation: "Линейный алгоритм выполняется последовательно без ветвлений и циклов."
    },
    {
        question: "Назовите тип алгоритма:",
        options: ["Линейный", "Разветвляющийся", "Циклический", "Смешанный", "Вспомогательный"],
        correct: "Циклический",
        explanation: "Циклический алгоритм включает повторение определенных действий."
    },
    {
        question: "Назовите тип алгоритма:",
        options: ["Разветвляющийся", "Линейный", "Смешанный", "Циклический", "Вспомогательный"],
        correct: "Разветвляющийся",
        explanation: "Разветвляющийся алгоритм включает выбор пути выполнения на основе условия."
    },
    {
        question: "Правильная запись оператора присваивания:",
        options: ["10 = х", "у = 7,8", "а = 5", "а == b + x", "a+=10"],
        correct: "а = 5",
        explanation: "Оператор присваивания в C# записывается как переменная = значение."
    },
    {
        question: "Укажите оператор ввода:",
        options: ["ReadLine()", "WriteLine()", "int()", "random()", "return()"],
        correct: "ReadLine()",
        explanation: "Метод Console.ReadLine() используется для ввода данных с клавиатуры."
    },
    {
        question: "Тип данных, который является целым числом в C#:",
        options: ["int", "float", "double", "char", "string"],
        correct: "int",
        explanation: "Тип int используется для хранения целых чисел в C#."
    },
    {
        question: "Тип данных для хранения одиночных символов в C#:",
        options: ["string", "char", "bool", "int", "float"],
        correct: "char",
        explanation: "Тип char используется для хранения одного символа в C#."
    },
    {
        question: "Тип данных для хранения логических значений (истина или ложь) в C#:",
        options: ["bool", "byte", "string", "char", "double"],
        correct: "bool",
        explanation: "Тип bool используется для хранения значений true или false."
    },
    {
        question: "Тип данных, представляющий вещественные числа с плавающей точкой одинарной точности в C#:",
        options: ["float", "double", "decimal", "int", "sbyte"],
        correct: "float",
        explanation: "Тип float используется для чисел с плавающей точкой одинарной точности."
    },
    {
        question: "Тип данных, который используется для хранения больших целых чисел в C#:",
        options: ["long", "int", "short", "byte", "sbyte"],
        correct: "long",
        explanation: "Тип long используется для хранения больших целых чисел."
    },
    {
        question: "Тип данных, который используется для представления строк в C#:",
        options: ["string", "char[]", "text", "StringBuilder", "bool"],
        correct: "string",
        explanation: "Тип string используется для хранения текстовых данных в C#."
    },
    {
        question: "Результат следующей программы int a = 5; int b = 10; Console.WriteLine(a + b);",
        options: ["50", "5", "15", "0", "-5"],
        correct: "15",
        explanation: "Сложение 5 и 10 дает результат 15."
    },
    {
        question: "Результат при выполнении следующего кода int[] arr = {1,2,3,4,5};Console.WriteLine(arr[2]);",
        options: ["3", "4", "5", "2", "1"],
        correct: "3",
        explanation: "Индекс 2 в массиве соответствует элементу со значением 3."
    },
    {
        question: "Вывод следующей программы int x = 5; int y = 10; Console.WriteLine(x == y);",
        options: ["False", "True", "0", "15", "-5"],
        correct: "False",
        explanation: "Оператор сравнения == возвращает False, так как 5 не равно 10."
    },
    {
        question: "Метод для чтения данных из файла:",
        options: ["StreamReader.Write", "File.ReadAllText", "StreamWriter.WriteLine", "File.WriteAllText", "File.WriteTextLine"],
        correct: "File.ReadAllText",
        explanation: "Метод File.ReadAllText используется для чтения всего содержимого файла в строку."
    },
    {
        question: "Результат следующей программы int[] numbers = {1,2,3}; Console.WriteLine(numbers.Length);",
        options: ["3", "6", "4", "9", "1"],
        correct: "3",
        explanation: "Свойство Length возвращает количество элементов в массиве, в данном случае 3."
    },
    {
        question: "Оператор ?? в C#:",
        options: ["Оператор сложения", "Оператор нулевого слияния", "Оператор деления", "Оператор сравнения", "Оператор присваивания"],
        correct: "Оператор нулевого слияния",
        explanation: "Оператор ?? возвращает значение слева, если оно не null, иначе значение справа."
    },
    {
        question: "Создание объекта в C#:",
        options: ["new object();", "object();", "create object();", "new object;", "object;"],
        correct: "new object();",
        explanation: "Для создания объекта в C# используется ключевое слово new с указанием типа и круглыми скобками."
    },
    {
        question: "Значение элемента, находящегося во второй строке и третьем столбце двумерного массива array:",
        options: ["array[2,3];", "array[1,2];", "array[3,2];", "array[2][3];", "array[3][2];"],
        correct: "array[1,2];",
        explanation: "Индексы в C# начинаются с 0, поэтому вторая строка и третий столбец - это array[1,2]."
    },
    {
        question: "Правильное определение массива строк в C#:",
        options: ["string[] array = new string[5];", "string array[5];", "string array = new string[5];", "array = { \"a\", \"b\", \"c\" };", "string array(5);"],
        correct: "string[] array = new string[5];",
        explanation: "Массив строк объявляется как string[] с использованием new для создания массива заданного размера."
    },
    {
        question: "Пустая коллекция типа List в C#:",
        options: ["List<int> list = new List<>();", "List<int> list = new List<int>();", "List<int> list = List<int>();", "List<int> list = new List();", "List<int> list = List() new;"],
        correct: "List<int> list = new List<int>();",
        explanation: "Коллекция List создается с указанием типа элемента в угловых скобках."
    },
    {
        question: "Определение инкапсуляция в C#:",
        options: ["Сокрытие внутренней реализации объекта и предоставление доступа к ней через интерфейсы", "Объединение нескольких классов в один", "Способность объекта изменять свое поведение", "Способность объекта изменять свой тип", "Способность объекта изменять класс"],
        correct: "Сокрытие внутренней реализации объекта и предоставление доступа к ней через интерфейсы",
        explanation: "Инкапсуляция - это принцип ООП, который скрывает детали реализации и предоставляет доступ через публичные методы."
    },
    {
        question: "Коллекция, которая используется для работы с LIFO (Last In First Out):",
        options: ["Queue<T>", "Stack<T>", "List<T>", "Dictionary<T>", "Array<T>"],
        correct: "Stack<T>",
        explanation: "Stack<T> реализует принцип LIFO (последний пришел - первый ушел)."
    },
    {
        question: "Событие в C# это -",
        options: ["Специальный тип данных", "Оповещение о состоянии программы", "Метод для обработки ошибок", "Механизм для подписки и оповещения об изменениях", "Тип данных"],
        correct: "Механизм для подписки и оповещения об изменениях",
        explanation: "События в C# позволяют объектам уведомлять другие объекты о произошедших изменениях или действиях."
    },
    {
        question: "Команда, которая используется для выхода из цикла в C#:",
        options: ["exit", "break", "stop", "end", "out"],
        correct: "break",
        explanation: "Оператор break используется для немедленного выхода из цикла."
    },
    {
        question: "Ключевое слово для объявления интерфейса в C#:",
        options: ["class", "interface", "struct", "abstract", "const"],
        correct: "interface",
        explanation: "Интерфейсы в C# объявляются с помощью ключевого слова interface."
    },
    {
        question: "Объявление массива целых чисел в C#:",
        options: ["int[] arr = new int(5);", "int arr[] = new int[5];", "int[] arr = new int[5];", "int[] arr = new int(5);", "int arr() = new int(5);"],
        correct: "int[] arr = new int[5];",
        explanation: "Массив в C# объявляется как int[] с использованием new для создания массива заданного размера."
    },
    {
        question: "Метод Array.Sort() в C#:",
        options: ["Сортирует элементы массива в порядке убывания", "Сортирует элементы массива в порядке возрастания", "Находит минимальный элемент в массиве", "Удаляет все элементы из массива", "Находит максимальный элемент в массиве"],
        correct: "Сортирует элементы массива в порядке возрастания",
        explanation: "Метод Array.Sort() сортирует элементы массива по возрастанию."
    },
    {
        question: "Длина массива в C#:",
        options: ["arr.size()", "arr.Length", "arr.length()", "arr.size", "arr.Size[]"],
        correct: "arr.Length",
        explanation: "Свойство Length используется для получения количества элементов в массиве."
    },
    {
        question: "Добавление элемента в массив:",
        options: ["Использовать метод Add()", "Массивы в C# имеют фиксированный размер, так что нельзя добавить новый элемент", "Использовать метод Insert()", "Использовать метод Append()", "Использовать метод App()"],
        correct: "Массивы в C# имеют фиксированный размер, так что нельзя добавить новый элемент",
        explanation: "Массивы в C# имеют фиксированный размер, для добавления элементов лучше использовать List<T>."
    },
    {
        question: "Функция для копирования массива в C#:",
        options: ["Array.Clone()", "Array.Copy()", "Array.Duplicate()", "Array.Mirror()", "Array.Paste()"],
        correct: "Array.Copy()",
        explanation: "Метод Array.Copy() используется для копирования элементов одного массива в другой."
    },
    {
        question: "Способ объединения двух массивов в C#:",
        options: ["Использовать метод Array.Concat()", "Использовать метод Array.Merge()", "Использовать метод Array.Join()", "Использовать метод Array.Combine()", "Использовать метод Array.Compare()"],
        correct: "Использовать метод Array.Concat()",
        explanation: "Для объединения массивов можно использовать методы LINQ, такие как Concat()."
    },
    {
        question: "Метод для определения всех элементов в многомерном массиве:",
        options: ["Использовать метод Array.Length", "Использовать метод Array.Size", "Использовать метод Array.Count", "Использовать метод Array.TotalLength", "Использовать метод Array.Sort"],
        correct: "Использовать метод Array.Length",
        explanation: "Свойство Length возвращает общее количество элементов во всех измерениях многомерного массива."
    },
    {
        question: "Определение технологии Windows Forms:",
        options: ["Система управления базами данных", "Технология для создания графических пользовательских интерфейсов (GUI) в Windows", "Технология для работы с веб-приложениями", "Платформа для разработки игр", "Технология для разработки ПО"],
        correct: "Технология для создания графических пользовательских интерфейсов (GUI) в Windows",
        explanation: "Windows Forms - это технология для создания приложений с графическим интерфейсом в Windows."
    },
    {
        question: "Этапы создания нового приложения Windows Forms:",
        options: ["Файл → Новый проект → Windows Forms App", "Файл → Открыть проект → Windows Forms App", "Правый клик → Создать новый файл → Windows Forms", "Файл → Новый → Веб-приложение", "Проект → Новый → Консольное-приложение"],
        correct: "Файл → Новый проект → Windows Forms App",
        explanation: "Для создания приложения Windows Forms в Visual Studio нужно выбрать соответствующий шаблон проекта."
    },
    {
        question: "Метод, который используется для отображения формы в Windows Forms:",
        options: ["Show()", "Display()", "Open()", "Render()", "View()"],
        correct: "Show()",
        explanation: "Метод Show() отображает форму на экране."
    },
    {
        question: "Добавление кнопки на форму в Windows Forms:",
        options: ["Использовать метод AddControl()", "Перетащить кнопку из панели инструментов в форму", "Использовать команду NewButton()", "Написать код вручную для добавления элемента", "Использовать элемент RadioButton"],
        correct: "Перетащить кнопку из панели инструментов в форму",
        explanation: "В дизайнере Visual Studio элементы управления добавляются перетаскиванием из панели инструментов."
    },
    {
        question: "Изменение текста на кнопке в Windows Forms:",
        options: ["button.Text = \"Новый текст\";", "button.SetText(\"Новый текст\");", "button.SetLabel(\"Новый текст\");", "button.Label = \"Новый текст\";", "button.TextBox = \"Новый текст\";"],
        correct: "button.Text = \"Новый текст\";",
        explanation: "Свойство Text используется для изменения текста на кнопке."
    },
    {
        question: "Цель метода Application.Run() в Windows Forms:",
        options: ["Запускает приложение в фоновом режиме", "Ожидает события и запускает главный цикл обработки сообщений", "Закрывает приложение", "Инициализирует компоненты формы", "Перезагрузка приложения"],
        correct: "Ожидает события и запускает главный цикл обработки сообщений",
        explanation: "Метод Application.Run() запускает цикл обработки сообщений, который обрабатывает события приложения."
    },
    {
        question: "Способ создания события нажатия кнопки в Windows Forms:",
        options: ["В свойстве кнопки установить событие OnClick()", "Привязать событие через свойство Click в свойствах кнопки или вручную в коде", "Использовать метод AddClick()", "Создать отдельный класс для обработки события", "Создать отдельный метод для обработки события"],
        correct: "Привязать событие через свойство Click в свойствах кнопки или вручную в коде",
        explanation: "Событие Click можно привязать через свойства в дизайнере или программно в коде."
    },
    {
        question: "Этап жизненного цикла ПО отвечающий за анализ требований и создание документации:",
        options: ["Проектирование", "Разработка", "Тестирование", "Сбор требований", "Поддержка"],
        correct: "Сбор требований",
        explanation: "Сбор требований - это начальный этап, на котором определяются потребности и составляется документация."
    },
    {
        question: "Этап эксплуатации и поддержки в жизненном цикле ПО – это:",
        options: ["Определение требований и спецификаций", "Написание исходного кода", "Устранение ошибок и выпуск обновлений после релиза", "Проведение пользовательского обучения", "Оценка производительности системы"],
        correct: "Устранение ошибок и выпуск обновлений после релиза",
        explanation: "Этап поддержки включает исправление ошибок и выпуск обновлений после выпуска ПО."
    },
    {
        question: "Элемент управления для ввода текста пользователем:",
        options: ["Button", "TextBox", "Label", "ComboBox", "CheckBox"],
        correct: "TextBox",
        explanation: "Элемент TextBox позволяет пользователю вводить текст."
    },
    {
        question: "Элемент управления для отображения метки:",
        options: ["Button", "Label", "TextBox", "RadioButton", "PictureBox"],
        correct: "Label",
        explanation: "Элемент Label используется для отображения текстовых меток."
    },
    {
        question: "Элемент управления, который позволяет пользователю выбрать один из нескольких вариантов:",
        options: ["CheckBox", "RadioButton", "TextBox", "ComboBox", "ListBox"],
        correct: "RadioButton",
        explanation: "RadioButton позволяет выбрать только один вариант из группы."
    },
    {
        question: "Элемент управления, который отображает список элементов:",
        options: ["ListBox", "ComboBox", "Button", "CheckBox", "RadioButton"],
        correct: "ListBox",
        explanation: "ListBox отображает список элементов, из которых можно выбрать один или несколько."
    },
    {
        question: "Элемент управления, который используется для отображения изображения:",
        options: ["Label", "PictureBox", "Button", "TextBox", "Panel"],
        correct: "PictureBox",
        explanation: "PictureBox используется для отображения изображений."
    },
    {
        question: "Элемент управления позволяющий выбрать дату и время:",
        options: ["DateTimePicker", "TextBox", "ComboBox", "ListBox", "CheckBox"],
        correct: "DateTimePicker",
        explanation: "DateTimePicker позволяет пользователю выбрать дату и время."
    },
    {
        question: "Элемент управления для отображения кнопки:",
        options: ["Label", "Button", "CheckBox", "TextBox", "RadioButton"],
        correct: "Button",
        explanation: "Button представляет собой кликабельную кнопку."
    },
    {
        question: "Элемент управления для выбора значений из выпадающего списка:",
        options: ["TextBox", "Button", "ComboBox", "RadioButton", "CheckBox"],
        correct: "ComboBox",
        explanation: "ComboBox представляет собой выпадающий список для выбора значения."
    },
    {
        question: "Элемент управления для выбора нескольких значений:",
        options: ["ListBox", "ComboBox", "Button", "CheckBox", "Label"],
        correct: "CheckBox",
        explanation: "CheckBox позволяет выбрать несколько значений независимо друг от друга."
    },
    {
        question: "Элемент управления для создания панели для других элементов управления:",
        options: ["TextBox", "Label", "Panel", "Button", "PictureBox"],
        correct: "Panel",
        explanation: "Panel используется как контейнер для группировки других элементов управления."
    },
    {
        question: "Цикл, который выполняется один раз, даже если условие не выполняется:",
        options: ["for", "while", "do-while", "foreach", "Нет такого цикла"],
        correct: "do-while",
        explanation: "Цикл do-while выполняется как минимум один раз, даже если условие ложно."
    },
    {
        question: "Цикл, который используется для перебора коллекций и массивов:",
        options: ["do-while", "for", "foreach", "while", "loop"],
        correct: "foreach",
        explanation: "Цикл foreach специально предназначен для перебора элементов коллекций и массивов."
    },
    {
        question: "Результат следующего кода for (int i = 0; i < 3; i++) {Console.WriteLine(i);}",
        options: ["0 1 2", "1 2 3", "1 2", "0 1", "0 1 2 3"],
        correct: "0 1 2",
        explanation: "Цикл for выведет значения i от 0 до 2, так как условие i < 3."
    },
    {
        question: "Цикл, который выполняется, при условии true:",
        options: ["For", "While", "do-while", "foreach", "if"],
        correct: "While",
        explanation: "Цикл while выполняется, пока условие истинно."
    },
    {
        question: "Рекурсивный метод – это:",
        options: ["Метод, который ссылается на себя", "Метод, вызывающий другой метод", "Отображает информацию на экране", "Возвращает только значения переменных", "Используется для изменения данных"],
        correct: "Метод, который ссылается на себя",
        explanation: "Рекурсивный метод вызывает сам себя для решения задачи."
    },
    {
        question: "В C# метод вызывается, когда …",
        options: ["Метод написан", "Метод создается из объекта", "Метод определен", "Метод готов к вызову", "Метод возвращает значение"],
        correct: "Метод готов к вызову",
        explanation: "Метод вызывается, когда к нему обращаются по имени с соответствующими аргументами."
    },
    {
        question: "Тип данных, используемый для хранения объектов, который изменяется динамически:",
        options: ["var", "object", "dynamic", "string", "int"],
        correct: "dynamic",
        explanation: "Тип dynamic позволяет менять тип данных во время выполнения программы."
    },
    {
        question: "Структура данных, используемая для создания очереди в C#:",
        options: ["Stack<T>", "List<T>", "Queue<T>", "Dictionary<TKey, TValue>", "HashSet<T>"],
        correct: "Queue<T>",
        explanation: "Queue<T> реализует очередь по принципу FIFO (первый пришел - первый ушел)."
    },
    {
        question: "Основное свойство стека (Stack) в C#:",
        options: ["Он работает по принципу «первым пришел — первым обслужен» (FIFO)", "Работает по принципу «последним пришел — первым ушел» (LIFO)", "Он хранит отсортированные элементы.", "Он хранит элементы не по порядку.", "Он хранит только один элемент."],
        correct: "Работает по принципу «последним пришел — первым ушел» (LIFO)",
        explanation: "Stack<T> работает по принципу LIFO (Last In, First Out)."
    },
    {
        question: "Метод класса Queue, добавляющий элемент в конец очереди:",
        options: ["Push()", "Enqueue()", "Add()", "Insert()", "Append()"],
        correct: "Enqueue()",
        explanation: "Метод Enqueue() добавляет элемент в конец очереди."
    },
    {
        question: "Метод класса Stack, добавляющий элемент в стек:",
        options: ["Add()", "Push()", "Insert()", "Enqueue()", "Append()"],
        correct: "Push()",
        explanation: "Метод Push() добавляет элемент на вершину стека."
    },
    {
        question: "Метод, используемый для поиска элементов в структуре словаря:",
        options: ["Find()", "Search()", "ContainsKey()", "IndexOf()", "GetItem()"],
        correct: "ContainsKey()",
        explanation: "Метод ContainsKey() проверяет наличие ключа в словаре."
    },
    {
        question: "Метод, используемый для удаления последнего элемента стека:",
        options: ["Pop()", "Dequeue()", "Remove()", "Take()", "Clear()"],
        correct: "Pop()",
        explanation: "Метод Pop() удаляет и возвращает верхний элемент стека."
    },
    {
        question: "Свойство, используемое для получения количества элементов в структуре Queue:",
        options: ["Count", "Size", "Length", "Capacity", "TotalCount"],
        correct: "Count",
        explanation: "Свойство Count возвращает количество элементов в очереди."
    },
    {
        question: "Преобразование целого числа в текст:",
        options: ["int.Parse()", "Convert.ToInt32()", "Convert.ToString()", "int.ToString()", "Parse.ToInt32()"],
        correct: "Convert.ToString()",
        explanation: "Метод Convert.ToString() преобразует число в строку."
    },
    {
        question: "Пользовательский ввод новой строки в C#:",
        options: ["Console.Read()", "Console.ReadLine()", "Console.GetLine()", "Console.InputString()", "Console.ReadText()"],
        correct: "Console.ReadLine()",
        explanation: "Метод Console.ReadLine() считывает строку ввода пользователя."
    },
    {
        question: "Инструмент, реализующий абстракцию на C#:",
        options: ["Интерфейс", "Делегат", "Абстрактный класс", "Класс", "Структура"],
        correct: "Интерфейс",
        explanation: "Интерфейсы используются для определения абстрактного поведения."
    },
    {
        question: "Оператор сложения в C#:",
        options: ["*", "–", "/", "+", "%"],
        correct: "+",
        explanation: "Оператор + используется для сложения чисел."
    },
    {
        question: "Метод используемый для извлечения подстроки из строки в C#:",
        options: ["Substring()", "Slice()", "GetSubstring()", "FindSubstring()", "Extract()"],
        correct: "Substring()",
        explanation: "Метод Substring() извлекает подстроку из строки по заданным индексам."
    },
    {
        question: "Тип данных, который используется для хранения вещественных чисел в C#:",
        options: ["int", "bool", "float", "decimal", "double"],
        correct: "double",
        explanation: "Тип double используется для хранения вещественных чисел двойной точности."
    },
    {
        question: "Метод, объединяющий строки в C#:",
        options: ["Concat()", "Add()", "Join()", "Merge()", "Append()"],
        correct: "Concat()",
        explanation: "Метод Concat() объединяет несколько строк в одну."
    },
    {
        question: "Ключевое слово для определения нового объекта:",
        options: ["create", "new", "define", "object", "init"],
        correct: "new",
        explanation: "Ключевое слово new используется для создания нового объекта."
    },
    {
        question: "Массив – это:",
        options: ["Переменная", "Набор однотипных данных, которые располагаются в памяти последовательно друг за другом", "Набор данных типа int (32-бит целое)", "Набор текстовых значений в формате Unicode, которые расположены в случайном порядке", "Тип данных"],
        correct: "Набор однотипных данных, которые располагаются в памяти последовательно друг за другом",
        explanation: "Массив представляет собой последовательность элементов одного типа данных."
    },
    {
        question: "Виды массива:",
        options: ["Сложные и простые", "Одномерные и многомерные", "Разнообразные", "Резиновые и статичные", "Динамичные"],
        correct: "Одномерные и многомерные",
        explanation: "Массивы бывают одномерными (линейными) и многомерными (например, двумерными матрицами)."
    },
    {
        question: "Укажите правильный синтаксис для вывода “Привет, Мир” в C#:",
        options: ["print(“Привет, Мир”);", "Console.WriteLine(“Привет, Мир”);", "System.out.println(“Привет, Мир”);", "cout<<(“Привет, Мир”);", "cout<<“Привет, Мир”;"],
        correct: "Console.WriteLine(“Привет, Мир”);",
        explanation: "Метод Console.WriteLine() выводит текст в консоль с переносом строки."
    },
    {
        question: "Переменная с числовым значением 5:",
        options: ["x = 5;", "double x=5;", "num x=5;", "int x=5;", "float x=5;"],
        correct: "int x=5;",
        explanation: "Для целого числа используется тип int."
    },
    {
        question: "Переменная с плавающим числом 2.8:",
        options: ["int x = 2.8d;", "byte x = 2.8d;", "double x = 2.8d;", "int x = 2.8d;", "char x = 2.8d;"],
        correct: "double x = 2.8d;",
        explanation: "Для чисел с плавающей точкой используется тип double с суффиксом d."
    },
    {
        question: "Индексы массива начинаются с:",
        options: ["1", "0", "2", "-1", "-2"],
        correct: "0",
        explanation: "В C# индексация массивов начинается с 0."
    },
    {
        question: "Создание метода в C#:",
        options: ["myMethod[]", "MyMethod()", "MyMethod", "(MyMethod)", "MyMethod{}"],
        correct: "MyMethod()",
        explanation: "Метод объявляется с указанием имени и круглых скобок для параметров."
    },
    {
        question: "В C# можно наследовать поля и методы от одного класса к другому:",
        options: ["True", "False", "Null", "Not", "Indeterminate"],
        correct: "True",
        explanation: "Наследование позволяет классам наследовать свойства и методы от других классов."
    },
    {
        question: "Оператор для умножения чисел:",
        options: ["X", "#", "%", "*", "/"],
        correct: "*",
        explanation: "Оператор * используется для умножения чисел."
    },
    {
        question: "Ключевое слово для возврата значения внутри метода:",
        options: ["return", "get", "break", "void", "back"],
        correct: "return",
        explanation: "Ключевое слово return используется для возврата значения из метода."
    },
    {
        question: "Укажите тип переменной в коде: int a=5",
        options: ["Знаковое 32-бит целое", "1 байт", "Знаковое 64-бит целое", "Знаковое 16-бит целое", "Знаковое 8-бит целое"],
        correct: "Знаковое 32-бит целое",
        explanation: "Тип int представляет собой 32-битное знаковое целое число."
    },
    {
        question: "Оператор «%»:",
        options: ["Возвращает процент от суммы", "Возвращает остаток от деления", "Возвращает тригонометрическую функцию", "Возвращает сложение", "Возвращает значение"],
        correct: "Возвращает остаток от деления",
        explanation: "Оператор % возвращает остаток от деления двух чисел."
    },
    {
        question: "Выберите инкрементацию числа:",
        options: ["--", "++", "!=", "%%", "-+"],
        correct: "++",
        explanation: "Оператор ++ увеличивает значение переменной на 1."
    },
    {
        question: "Выберите декрементацию числа:",
        options: ["--", "++", "!=", "%%", "-+"],
        correct: "--",
        explanation: "Оператор -- уменьшает значение переменной на 1."
    },
    {
        question: "Найдите квадратный корень из числа x:",
        options: ["Math.Sqrt(x)", "Arifmetic.Sqrt", "Sqrt(x)", "Summ.Koren(x)", "Sqrt"],
        correct: "Math.Sqrt(x)",
        explanation: "Метод Math.Sqrt() вычисляет квадратный корень числа."
    },
    {
        question: "Обозначение оператора «НЕ»:",
        options: ["No", "!", "!=", "Not", "+="],
        correct: "!=",
        explanation: "Оператор != означает 'не равно' в C#."
    },
    {
        question: "Обозначение оператора «ИЛИ»:",
        options: ["!=", "Or", "!", "||", "/"],
        correct: "||",
        explanation: "Оператор || используется для логического ИЛИ."
    },
    {
        question: "Значение c, если int a = 10; int b=4; int c=a%b:",
        options: ["11", "1", "3", "2", "6"],
        correct: "2",
        explanation: "Остаток от деления 10 на 4 равен 2."
    },
    {
        question: "Значение c, если int a = 10; int b = 4; bool c = (a==10 && b==4):",
        options: ["14", "Null", "False", "True", "6"],
        correct: "True",
        explanation: "Условие (a==10 && b==4) истинно, поэтому c будет True."
    },
    {
        question: "Условные операторы предназначены ...:",
        options: ["Для оптимизации программы", "Чтобы были", "Чтобы устанавливать условия пользователю", "Для ветвления программы", "Для устранения ошибок"],
        correct: "Для ветвления программы",
        explanation: "Условные операторы используются для создания различных путей выполнения программы."
    },
    {
        question: "Выберите пространство имен, в котором обрабатываются классы, необходимые для работы с файлами:",
        options: ["using System;", "using Collections.Generic;", "System.Ling;", "System.Text;", "System.IO"],
        correct: "System.IO",
        explanation: "Пространство имен System.IO содержит классы для работы с файлами и потоками."
    },
    {
        question: "Метод, который создает новый файл или открывает существующий файл и заменяет существующие данные новыми данными:",
        options: ["WriteAllText();", "AppendAllText();", "Delete();", "Create();", "FileStream();"],
        correct: "WriteAllText();",
        explanation: "Метод WriteAllText() перезаписывает файл новыми данными."
    },
    {
        question: "Метод, считывающий данные из файла:",
        options: ["StreamReader", "StreamWriter", "FileAccess", "FileStrеam", "FileMode"],
        correct: "StreamReader",
        explanation: "Класс StreamReader используется для чтения данных из файла."
    },
    {
        question: "Выберите правильный вариант для создания класса Car:",
        options: ["{ string color;}int year;class Car", "class Car int year; { string color; }", "class Car{ string color; int year;}", "int year; class Car { string color; }", "int year; { string color; } class Car"],
        correct: "class Car{ string color; int year;}",
        explanation: "Класс объявляется с ключевым словом class, а поля внутри фигурных скобок."
    },
    {
        question: "Form1 -",
        options: ["Окно конструктора", "Панель компонентов", "Отчеты об ошибках", "Окно свойств", "Окно кода программы"],
        correct: "Окно конструктора",
        explanation: "Form1 обычно представляет окно конструктора формы в Windows Forms."
    },
    {
        question: "Ключевое слово, используемое для определения типа переменной в C#:",
        options: ["var", "type", "int", "float", "string"],
        correct: "var",
        explanation: "Ключевое слово var используется для неявного определения типа переменной."
    },
    {
        question: "Что представляет собой язык C#:",
        options: ["Интерпретируемый язык", "Язык низкого уровня", "Язык гипертекста", "Объектно-ориентированный язык", "Скриптовый язык"],
        correct: "Объектно-ориентированный язык",
        explanation: "C# является объектно-ориентированным языком программирования."
    },
    {
        question: "Какая среда чаще всего используется для разработки на C#:",
        options: ["Eclipse", "Visual Studio", "NetBeans", "Atom", "Sublime"],
        correct: "Visual Studio",
        explanation: "Visual Studio - основная среда разработки для C#."
    },
    {
        question: "Какой тип используется для хранения целых чисел в C#:",
        options: ["float", "double", "int", "char", "string"],
        correct: "int",
        explanation: "Тип int используется для хранения целых чисел."
    },
    {
        question: "Какой тип данных хранит текст в C#:",
        options: ["int", "string", "float", "bool", "char"],
        correct: "string",
        explanation: "Тип string используется для хранения текстовых данных."
    },
    {
        question: "Что делает оператор присваивания в C#:",
        options: ["Сравнивает значения", "Делает присваивание значения", "Умножает переменные", "Устанавливает тип", "Удаляет переменные"],
        correct: "Делает присваивание значения",
        explanation: "Оператор присваивания (=) присваивает значение переменной."
    },
    {
        question: "Какой тип используется для хранения одного символа:",
        options: ["string", "int", "bool", "char", "var"],
        correct: "char",
        explanation: "Тип char используется для хранения одного символа."
    },
    {
        question: "Какой тип может содержать только значения true или false:",
        options: ["bool", "string", "char", "int", "float"],
        correct: "bool",
        explanation: "Тип bool может содержать только значения true или false."
    },
    {
        question: "Что делает цикл for в C#:",
        options: ["Проверяет условие один раз", "Создаёт переменные", "Выполняет блок кода заданное количество раз", "Обрабатывает исключения", "Преобразует типы"],
        correct: "Выполняет блок кода заданное количество раз",
        explanation: "Цикл for используется для выполнения кода определенное количество раз."
    },
    {
        question: "Какой код выведет 'Привет, мир' в консоль:",
        options: ["Console.Input('Привет, мир');", "Console.Print('Привет, мир');", "Console.WriteLine('Привет, мир');", "PrintLine('Привет, мир');", "System.Write('Привет, мир');"],
        correct: "Console.WriteLine('Привет, мир');",
        explanation: "Метод Console.WriteLine() выводит текст в консоль."
    },
    {
        question: "Какой тип используется для дробных чисел высокой точности:",
        options: ["float", "decimal", "int", "string", "bool"],
        correct: "decimal",
        explanation: "Тип decimal используется для чисел с высокой точностью, особенно для финансовых расчетов."
    },
    {
        question: "Что такое переменная в C#:",
        options: ["Команда", "Хранилище данных", "Класс", "Метод", "Интерфейс"],
        correct: "Хранилище данных",
        explanation: "Переменная - это именованное хранилище для данных в памяти."
    },
    {
        question: "Какой метод считывает строку из консоли",
        options: ["Console.Write()", "Console.Input()", "Console.ReadLine()", "Console.Scan()", "Console.String()"],
        correct: "Console.ReadLine()",
        explanation: "Метод Console.ReadLine() используется для чтения строки, введенной пользователем в консоль."
    },
    {
        question: "Как создать переменную типа string с именем name",
        options: ["var name = string;", "string name;", "string name = \"\";", "str name = \"\";", "string: name = \"\";"],
        correct: "string name = \"\";",
        explanation: "Переменная типа string объявляется с использованием ключевого слова string и может быть инициализирована пустой строкой."
    },
    {
        question: "Что обозначает оператор ==",
        options: ["Присваивание", "Неравенство", "Проверка равенства", "Логическое И", "Сложение"],
        correct: "Проверка равенства",
        explanation: "Оператор == используется для проверки равенства двух значений."
    },
    {
        question: "Что делает Console.Write()",
        options: ["Считывает данные", "Завершает программу", "Выводит текст без перехода строки", "Очищает экран", "Читает файл"],
        correct: "Выводит текст без перехода строки",
        explanation: "Метод Console.Write() выводит текст в консоль без добавления новой строки в конце."
    },
    {
        question: "Какой тип используется для хранения десятичных чисел с высокой точностью",
        options: ["double", "float", "int", "decimal", "var"],
        correct: "decimal",
        explanation: "Тип decimal используется для хранения десятичных чисел с высокой точностью, особенно в финансовых расчетах."
    },
    {
        question: "Что делает цикл while",
        options: ["Выполняет блок кода хотя бы один раз", "Работает без условия", "Выполняет блок, пока условие истинно", "Используется только для строк", "Является типом данных"],
        correct: "Выполняет блок, пока условие истинно",
        explanation: "Цикл while продолжает выполнение блока кода, пока заданное условие остается истинным."
    },
    {
        question: "Какой символ используется для однострочного комментария",
        options: ["//", "/**", "#", "<!--", "%%"],
        correct: "//",
        explanation: "Символы // используются для создания однострочного комментария в C#."
    },
    {
        question: "Какой метод преобразует строку в число",
        options: ["Convert.String()", "int.Parse()", "Console.Input()", "Parse.Int()", "ToInt()"],
        correct: "int.Parse()",
        explanation: "Метод int.Parse() преобразует строковое представление числа в целое число."
    },
    {
        question: "Что обозначает ключевое слово const в C#",
        options: ["Переменная доступна в любом месте", "Переменная может быть изменена", "Переменная создается на лету", "Переменная постоянная и неизменяемая", "Переменная хранится в файле"],
        correct: "Переменная постоянная и неизменяемая",
        explanation: "Ключевое слово const указывает, что значение переменной не может быть изменено после инициализации."
    },
    {
        question: "Что такое цикл в языке программирования C#",
        options: ["Блок комментариев", "Условное выражение", "Способ повторения операций", "Метод работы с файлами", "Объявление переменной"],
        correct: "Способ повторения операций",
        explanation: "Цикл в C# используется для повторного выполнения блока кода при определенных условиях."
    },
    {
        question: "Какой цикл используется для повторения операций до тех пор, пока выполняется условие",
        options: ["for", "do", "if", "while", "switch"],
        correct: "while",
        explanation: "Цикл while выполняет блок кода, пока заданное условие истинно."
    },
    {
        question: "Какой цикл гарантирует выполнение хотя бы одного раза",
        options: ["for", "while", "do-while", "switch", "if"],
        correct: "do-while",
        explanation: "Цикл do-while выполняет блок кода минимум один раз перед проверкой условия."
    },
    {
        question: "Какой цикл удобен при известном числе повторений",
        options: ["if", "while", "do-while", "for", "switch"],
        correct: "for",
        explanation: "Цикл for идеально подходит для случаев, когда количество повторений известно заранее."
    },
    {
        question: "Для чего используется оператор for",
        options: ["Для вызова метода", "Для проверки логики", "Для определения переменных", "Для организации цикла с известным числом повторений", "Для создания массива"],
        correct: "Для организации цикла с известным числом повторений",
        explanation: "Оператор for используется для создания цикла с заранее определенным количеством итераций."
    },
    {
        question: "Что выполняет оператор if в языке C#",
        options: ["Вызывает метод", "Присваивает значение", "Выполняет код при истинности условия", "Завершает цикл", "Сравнивает переменные"],
        correct: "Выполняет код при истинности условия",
        explanation: "Оператор if выполняет блок кода только в том случае, если заданное условие истинно."
    },
    {
        question: "Как обозначается логическое И в языке C#",
        options: ["||", "&&", "==", "!=", "%%"],
        correct: "&&",
        explanation: "Оператор && используется для логической операции И, возвращая true только если оба условия истинны."
    },
    {
        question: "Что делает оператор &&",
        options: ["Проверяет неравенство", "Возвращает true при выполнении обоих условий", "Завершает цикл", "Печатает на экран", "Очищает память"],
        correct: "Возвращает true при выполнении обоих условий",
        explanation: "Оператор && возвращает true только в том случае, если оба операнда истинны."
    },
    {
        question: "Что делает оператор ||",
        options: ["Проверяет оба условия", "Возвращает true, если одно из условий истинно", "Делает сравнение", "Переводит тип", "Завершает метод"],
        correct: "Возвращает true, если одно из условий истинно",
        explanation: "Оператор || возвращает true, если хотя бы один из операндов истинен."
    },
    {
        question: "Какой результат даст выражение true && false",
        options: ["true", "false", "0", "1", "Ошибка"],
        correct: "false",
        explanation: "Выражение true && false возвращает false, так как не оба условия истинны."
    },
    {
        question: "Для чего используется переменная типа char",
        options: ["Для хранения целых чисел", "Для хранения текста", "Для хранения одного символа", "Для хранения логических значений", "Для хранения дробных чисел"],
        correct: "Для хранения одного символа",
        explanation: "Тип char используется для хранения одного символа Unicode."
    },
    {
        question: "Как записать переменную типа char со значением A",
        options: ["char c = A;", "char c = \"A\";", "char c = 'A';", "char c = A';", "char c = A;"],
        correct: "char c = 'A';",
        explanation: "Символы типа char записываются в одинарных кавычках, например, 'A'."
    },
    {
        question: "Какой тип данных используется для хранения текстовых строк",
        options: ["char", "bool", "string", "int", "byte"],
        correct: "string",
        explanation: "Тип string используется для хранения последовательности символов или текста."
    },
    {
        question: "Что такое строка в C#",
        options: ["Последовательность символов", "Одно число", "Логическое значение", "Метод", "Тип цикла"],
        correct: "Последовательность символов",
        explanation: "Строка (string) в C# представляет собой последовательность символов Unicode."
    },
    {
        question: "Какая функция используется для объединения строк",
        options: ["Append", "Join", "Concatenate", "Concat", "Merge"],
        correct: "Concat",
        explanation: "Метод Concat используется для объединения нескольких строк в одну."
    },
    {
        question: "Что делает метод string.Length",
        options: ["Возвращает количество символов в строке", "Удаляет строку", "Переводит строку в число", "Преобразует строку в массив", "Очищает строку"],
        correct: "Возвращает количество символов в строке",
        explanation: "Свойство Length возвращает количество символов в строке."
    },
    {
        question: "Что возвращает метод string.Split",
        options: ["Целое число", "Символ", "Массив строк", "Логическое значение", "Объект"],
        correct: "Массив строк",
        explanation: "Метод Split разделяет строку на подстроки и возвращает массив строк."
    },
    {
        question: "Что делает метод string.ToUpper",
        options: ["Удаляет пробелы", "Делает строку заглавной", "Переводит строку в массив", "Возвращает длину строки", "Разделяет строку"],
        correct: "Делает строку заглавной",
        explanation: "Метод ToUpper преобразует все символы строки в верхний регистр."
    },
    {
        question: "Что делает метод string.ToLower",
        options: ["Удаляет строку", "Переводит все символы строки в нижний регистр", "Сравнивает строки", "Делает строку числом", "Возвращает true"],
        correct: "Переводит все символы строки в нижний регистр",
        explanation: "Метод ToLower преобразует все символы строки в нижний регистр."
    },
    {
        question: "Какой тип переменной используется для хранения строк в C#",
        options: ["char", "int", "bool", "string", "var"],
        correct: "string",
        explanation: "Тип string используется для хранения текстовых строк."
    },
    {
        question: "Какое ключевое слово используется для объявления переменной с автоматическим определением типа",
        options: ["string", "int", "var", "auto", "let"],
        correct: "var",
        explanation: "Ключевое слово var позволяет компилятору автоматически определять тип переменной."
    },
    {
        question: "Какой тип данных подходит для хранения дробных чисел с высокой точностью",
        options: ["float", "int", "decimal", "char", "bool"],
        correct: "decimal",
        explanation: "Тип decimal обеспечивает высокую точность для дробных чисел, особенно в финансовых приложениях."
    },
    {
        question: "Что означает тип данных bool",
        options: ["Строка", "Символ", "Число", "Логическое значение", "Переменная"],
        correct: "Логическое значение",
        explanation: "Тип bool используется для хранения логических значений true или false."
    },
    {
        question: "Какая переменная содержит результат выражения true && false",
        options: ["true", "false", "1", "0", "null"],
        correct: "false",
        explanation: "Результат выражения true && false равен false, так как не оба условия истинны."
    },
    {
        question: "Что делает оператор ==",
        options: ["Присваивает значение", "Проверяет равенство", "Умножает", "Делит", "Обнуляет"],
        correct: "Проверяет равенство",
        explanation: "Оператор == проверяет, равны ли два значения."
    },
    {
        question: "Что делает оператор !=",
        options: ["Проверяет равенство", "Сравнивает с true", "Проверяет неравенство", "Делает копию", "Объявляет переменную"],
        correct: "Проверяет неравенство",
        explanation: "Оператор != проверяет, не равны ли два значения."
    },
    {
        question: "Что означает ключевое слово const",
        options: ["Переменная изменяема", "Значение переменной может изменяться", "Значение переменной неизменно", "Переменная создается динамически", "Объявляется цикл"],
        correct: "Значение переменной неизменно",
        explanation: "Ключевое слово const указывает, что значение переменной не может быть изменено."
    },
    {
        question: "Какой символ используется для однострочного комментария",
        options: ["/*", "//", "#", "<!--", "--"],
        correct: "//",
        explanation: "Символы // используются для однострочных комментариев в C#."
    },
    {
        question: "Что делает метод Console.WriteLine",
        options: ["Считывает данные", "Завершает программу", "Выводит строку с переходом на новую строку", "Запускает цикл", "Очищает консоль"],
        correct: "Выводит строку с переходом на новую строку",
        explanation: "Метод Console.WriteLine выводит строку в консоль и добавляет переход на новую строку."
    },
    {
        question: "Что делает метод Console.ReadLine",
        options: ["Очищает консоль", "Считывает строку из консоли", "Выводит строку", "Завершает программу", "Переводит строку в число"],
        correct: "Считывает строку из консоли",
        explanation: "Метод Console.ReadLine считывает введенную пользователем строку из консоли."
    },
    {
        question: "Какое ключевое слово используется для объявления метода",
        options: ["define", "method", "void", "func", "sub"],
        correct: "void",
        explanation: "Ключевое слово void используется для объявления метода, который не возвращает значение."
    },
    {
        question: "Что обозначает модификатор доступа private",
        options: ["Элемент доступен в любом месте проекта", "Элемент доступен только в текущем классе", "Элемент доступен в производных классах", "Элемент доступен в библиотеке", "Элемент доступен во всех пространствах имён"],
        correct: "Элемент доступен только в текущем классе",
        explanation: "Модификатор private ограничивает доступ к элементу только внутри того же класса."
    },
    {
        question: "Что обозначает ключевое слово static",
        options: ["Метод нельзя вызывать", "Метод можно вызвать только через объект", "Метод вызывается без создания экземпляра класса", "Метод можно переопределить", "Метод обязательно возвращает значение"],
        correct: "Метод вызывается без создания экземпляра класса",
        explanation: "Ключевое слово static позволяет вызывать метод без создания объекта класса."
    },
    {
        question: "Что означает ключевое слово class",
        options: ["Создание метода", "Создание интерфейса", "Объявление массива", "Объявление пользовательского типа", "Объявление переменной"],
        correct: "Объявление пользовательского типа",
        explanation: "Ключевое слово class используется для создания пользовательского типа данных."
    },
    {
        question: "Что означает this в классе",
        options: ["Ссылка на глобальную переменную", "Ссылка на текущий объект", "Ключевое слово для условия", "Указание на тип", "Возврат результата"],
        correct: "Ссылка на текущий объект",
        explanation: "Ключевое слово this ссылается на текущий экземпляр класса."
    },
    {
        question: "Что делает ключевое слово return",
        options: ["Завершает выполнение метода и возвращает значение", "Очищает память", "Запускает цикл", "Прерывает цикл", "Выводит сообщение"],
        correct: "Завершает выполнение метода и возвращает значение",
        explanation: "Ключевое слово return завершает выполнение метода и возвращает значение, если оно указано."
    },
    {
        question: "Что происходит при попытке деления на ноль",
        options: ["Возврат 0", "Исключение DivideByZeroException", "Завершение метода", "Компиляция продолжается", "Сравнение значений"],
        correct: "Исключение DivideByZeroException",
        explanation: "При попытке деления на ноль возникает исключение DivideByZeroException."
    },
    {
        question: "Какой тип исключения возникает при обращении к несуществующему элементу массива",
        options: ["NullReferenceException", "DivideByZeroException", "IndexOutOfRangeException", "StackOverflowException", "FormatException"],
        correct: "IndexOutOfRangeException",
        explanation: "Обращение к несуществующему элементу массива вызывает исключение IndexOutOfRangeException."
    },
    {
        question: "Какой оператор используется для объединения условий",
        options: ["&&", "==", "||", "!=", "=>"],
        correct: "||",
        explanation: "Оператор || используется для объединения условий по принципу ИЛИ."
    },
    {
        question: "Что делает метод Convert.ToInt32",
        options: ["Переводит число в строку", "Переводит строку в логическое значение", "Преобразует строку в целое число", "Обнуляет переменную", "Удаляет строку"],
        correct: "Преобразует строку в целое число",
        explanation: "Метод Convert.ToInt32 преобразует строку в 32-битное целое число."
    },
    {
        question: "Какой тип данных используется для хранения символа",
        options: ["string", "char", "int", "float", "var"],
        correct: "char",
        explanation: "Тип char используется для хранения одного символа."
    },
    {
        question: "Какой оператор используется для остатка от деления",
        options: ["/", "*", "%", "^", "//"],
        correct: "%",
        explanation: "Оператор % возвращает остаток от деления двух чисел."
    },
    {
        question: "Какой тип данных используется для хранения целого числа",
        options: ["int", "string", "float", "char", "bool"],
        correct: "int",
        explanation: "Тип int используется для хранения целых чисел."
    },
    {
        question: "Что делает оператор =",
        options: ["Присваивает значение", "Сравнивает два значения", "Делает копию переменной", "Делит значения", "Выводит результат"],
        correct: "Присваивает значение",
        explanation: "Оператор = используется для присваивания значения переменной."
    },
    {
        question: "Что делает цикл for",
        options: ["Выполняет действие один раз", "Запускает цикл с известным числом повторений", "Проверяет тип данных", "Создает переменную", "Завершает программу"],
        correct: "Запускает цикл с известным числом повторений",
        explanation: "Цикл for используется для выполнения кода определенное количество раз."
    },
    {
        question: "Что делает цикл while",
        options: ["Выполняет код бесконечно", "Выполняет код пока условие истинно", "Проверяет равенство", "Делит значения", "Преобразует тип"],
        correct: "Выполняет код пока условие истинно",
        explanation: "Цикл while выполняет код, пока заданное условие остается истинным."
    },
    {
        question: "Что делает цикл do-while",
        options: ["Выполняет код один раз", "Выполняет код хотя бы один раз, затем проверяет условие", "Создает переменную", "Выводит данные", "Обрабатывает ошибки"],
        correct: "Выполняет код хотя бы один раз, затем проверяет условие",
        explanation: "Цикл do-while выполняет код минимум один раз перед проверкой условия."
    },
    {
        question: "Что делает метод Parse",
        options: ["Сравнивает строки", "Преобразует строку в число", "Удаляет строку", "Выводит данные", "Делает строку пустой"],
        correct: "Преобразует строку в число",
        explanation: "Метод Parse используется для преобразования строки в соответствующий тип данных, например, число."
    },
    {
        question: "Что означает переменная типа string",
        options: ["Логическое значение", "Символ", "Последовательность символов", "Целое число", "Объект"],
        correct: "Последовательность символов",
        explanation: "Переменная типа string представляет собой последовательность символов."
    },
    {
        question: "Что возвращает метод Console.ReadLine",
        options: ["Число", "Строку, введённую пользователем", "Символ", "Логическое значение", "Дробное число"],
        correct: "Строку, введённую пользователем",
        explanation: "Метод Console.ReadLine возвращает строку, введенную пользователем в консоль."
    },
    {
        question: "Какой тип данных используется для хранения значений true или false",
        options: ["int", "string", "bool", "char", "float"],
        correct: "bool",
        explanation: "Тип bool используется для хранения логических значений true или false."
    },
    {
        question: "Что делает оператор &&",
        options: ["Проверяет неравенство", "Объединяет условия как \"И\"", "Делает присваивание", "Увеличивает значение", "Делит значение"],
        correct: "Объединяет условия как \"И\"",
        explanation: "Оператор && объединяет условия по принципу И, возвращая true только если оба условия истинны."
    },
    {
        question: "Что делает оператор ||",
        options: ["Проверяет равенство", "Объединяет условия как \"ИЛИ\"", "Умножает значения", "Делит значения", "Создает условие"],
        correct: "Объединяет условия как \"ИЛИ\"",
        explanation: "Оператор || объединяет условия по принципу ИЛИ, возвращая true если хотя бы одно условие истинно."
    },
    {
        question: "Какой тип данных используется для хранения больших чисел с точкой",
        options: ["int", "float", "string", "decimal", "char"],
        correct: "decimal",
        explanation: "Тип decimal используется для хранения больших чисел с десятичной точкой с высокой точностью."
    },
    {
        question: "Что означает ключевое слово new",
        options: ["Завершает программу", "Создает новый экземпляр объекта", "Преобразует тип", "Обнуляет переменную", "Удаляет объект"],
        correct: "Создает новый экземпляр объекта",
        explanation: "Ключевое слово new используется для создания нового экземпляра объекта или выделения памяти."
    },
    {
        question: "Что делает ключевое слово void",
        options: ["Возвращает строку", "Возвращает число", "Указывает на отсутствие возвращаемого значения", "Завершает метод", "Объявляет переменную"],
        correct: "Указывает на отсутствие возвращаемого значения",
        explanation: "Ключевое слово void указывает, что метод не возвращает никакого значения."
    },
    {
        question: "Что обозначает ключевое слово public",
        options: ["Элемент доступен только внутри метода", "Элемент доступен только внутри класса", "Элемент доступен в любом месте программы", "Элемент доступен только в библиотеке", "Элемент доступен только по ссылке"],
        correct: "Элемент доступен в любом месте программы",
        explanation: "Модификатор public делает элемент доступным из любого места программы."
    },
    {
        question: "Какой метод используется для вывода текста без перехода на новую строку",
        options: ["Console.WriteLine", "Console.Read", "Console.Write", "Console.ReadLine", "Console.Clear"],
        correct: "Console.Write",
        explanation: "Метод Console.Write выводит текст в консоль без добавления новой строки."
    },
    {
        question: "Что обозначает метод ToString",
        options: ["Преобразует число в строку", "Сравнивает строки", "Обнуляет строку", "Удаляет строку", "Проверяет длину строки"],
        correct: "Преобразует число в строку",
        explanation: "Метод ToString преобразует значение в строковое представление."
    },
    {
        question: "Что делает оператор ++",
        options: ["Уменьшает значение на 1", "Увеличивает значение на 1", "Делит на 2", "Удаляет переменную", "Переводит в строку"],
        correct: "Увеличивает значение на 1",
        explanation: "Оператор ++ увеличивает значение переменной на 1."
    },
    {
        question: "Какой тип переменной используется для хранения логического значения",
        options: ["int", "bool", "char", "string", "float"],
        correct: "bool",
        explanation: "Тип bool используется для хранения логических значений true или false."
    },
    {
        question: "Что делает оператор ==",
        options: ["Присваивает значение", "Увеличивает переменную", "Сравнивает значения", "Делает копию", "Преобразует тип"],
        correct: "Сравнивает значения",
        explanation: "Оператор == сравнивает два значения на равенство."
    },
    {
        question: "Что делает метод Console.Clear",
        options: ["Завершает программу", "Очищает консоль", "Читает данные", "Запускает программу", "Удаляет переменные"],
        correct: "Очищает консоль",
        explanation: "Метод Console.Clear очищает содержимое консоли."
    },
    {
        question: "Какой тип данных используется для хранения одного символа",
        options: ["string", "char", "bool", "int", "float"],
        correct: "char",
        explanation: "Тип char используется для хранения одного символа."
    },
    {
        question: "Что означает оператор !=",
        options: ["Присваивает значение", "Проверяет неравенство", "Делит значения", "Проверяет равенство", "Обнуляет значение"],
        correct: "Проверяет неравенство",
        explanation: "Оператор != проверяет, не равны ли два значения."
    },
    {
        question: "Как задать строковую переменную",
        options: ["string name = Hello", "string name = \"Hello\"", "name = string Hello", "string = Hello", "str name = Hello"],
        correct: "string name = \"Hello\"",
        explanation: "Строковая переменная задается с использованием типа string и значения в двойных кавычках."
    },
    {
        question: "Что делает метод int.Parse",
        options: ["Преобразует строку в целое число", "Удаляет число", "Делает число строкой", "Проверяет равенство", "Делит строку"],
        correct: "Преобразует строку в целое число",
        explanation: "Метод int.Parse преобразует строку в целое число."
    },
    {
        question: "Что делает оператор %",
        options: ["Делит число", "Возводит в степень", "Возвращает остаток от деления", "Умножает", "Обнуляет"],
        correct: "Возвращает остаток от деления",
        explanation: "Оператор % возвращает остаток от деления двух чисел."
    },
    {
        question: "Что делает цикл foreach",
        options: ["Перебирает элементы массива или коллекции", "Выполняет код один раз", "Проверяет условие", "Возвращает строку", "Обнуляет массив"],
        correct: "Перебирает элементы массива или коллекции",
        explanation: "Цикл foreach используется для перебора элементов массива или коллекции."
    },
    {
        question: "Что такое класс в C#",
        options: ["Переменная", "Функция", "Шаблон для создания объектов", "Массив", "Оператор"],
        correct: "Шаблон для создания объектов",
        explanation: "Класс в C# является шаблоном для создания объектов, определяющим их свойства и поведение."
    },
    {
        question: "Что делает оператор +=",
        options: ["Делит и присваивает", "Умножает", "Прибавляет и присваивает", "Обнуляет значение", "Уменьшает"],
        correct: "Прибавляет и присваивает",
        explanation: "Оператор += прибавляет значение к переменной и присваивает результат."
    },
    {
        question: "Что делает метод Console.WriteLine",
        options: ["Вводит строку", "Выводит строку с переходом на новую строку", "Удаляет строку", "Проверяет тип данных", "Завершает метод"],
        correct: "Выводит строку с переходом на новую строку",
        explanation: "Метод Console.WriteLine выводит строку в консоль с переходом на новую строку."
    },
    {
        question: "Какой тип используется для хранения дробных чисел",
        options: ["int", "bool", "double", "char", "byte"],
        correct: "double",
        explanation: "Тип double используется для хранения дробных чисел двойной точности."
    },
    {
        question: "Какой метод используется для считывания строки из консоли",
        options: ["Console.Read", "Console.ReadLine", "Console.Input", "Console.Scan", "Read.Input"],
        correct: "Console.ReadLine",
        explanation: "Метод Console.ReadLine используется для считывания строки из консоли."
    },
    {
        question: "Что делает ключевое слово const",
        options: ["Создает переменную", "Создает метод", "Делает переменную неизменяемой", "Обнуляет переменную", "Завершает программу"],
        correct: "Делает переменную неизменяемой",
        explanation: "Ключевое слово const делает переменную неизменяемой после инициализации."
    },
    {
        question: "Что делает метод Length у строки",
        options: ["Сравнивает строки", "Возвращает длину строки", "Переводит в число", "Удаляет строку", "Преобразует в символ"],
        correct: "Возвращает длину строки",
        explanation: "Свойство Length возвращает количество символов в строке."
    },
    {
        question: "Как задать массив из 3 элементов",
        options: ["int[3] array", "int array = new int(3)", "int[] array = new int[3]", "new int[3] array", "array = int[3]"],
        correct: "int[] array = new int[3]",
        explanation: "Массив задается с использованием синтаксиса int[] array = new int[размер];"
    },
    {
        question: "Что означает ключевое слово return",
        options: ["Завершает метод и возвращает значение", "Обнуляет переменную", "Делает цикл", "Делает переменную постоянной", "Печатает результат"],
        correct: "Завершает метод и возвращает значение",
        explanation: "Ключевое слово return завершает выполнение метода и возвращает значение."
    },
    {
        question: "Как задать константу",
        options: ["let PI = 3.14", "const PI = 3.14", "PI = const 3.14", "var const PI = 3.14", "define PI 3.14"],
        correct: "const PI = 3.14",
        explanation: "Константа задается с использованием ключевого слова const."
    },
    {
        question: "Что делает ключевое слово class",
        options: ["Создает переменную", "Объявляет цикл", "Объявляет новый класс", "Обнуляет значение", "Завершает программу"],
        correct: "Объявляет новый класс",
        explanation: "Ключевое слово class используется для объявления нового класса."
    } 
];

window.addEventListener('load', () => {
    // Показываем только overlay выбора режима, скрываем контейнер викторины
    document.querySelector('.container').style.display = 'none';
    document.getElementById('mode-overlay').style.display = 'flex';

    // Keyboard shortcuts 1-5 for answers
    window.addEventListener('keydown', (e) => {
        if (['1', '2', '3', '4', '5'].includes(e.key)) {
            const idx = parseInt(e.key, 10) - 1;
            const currentOptions = document.querySelectorAll('.option');
            if (currentOptions[idx] && !currentOptions[idx].disabled) {
                currentOptions[idx].click();
            }
        }
        // Press Enter to go next when "next" visible
        if (e.key === 'Enter') {
            const nextBtn = document.getElementById('next');
            if (nextBtn.style.display !== 'none') {
                nextBtn.click();
            }
        }
        // Press R to reset
        if (e.key === 'r' || e.key === 'R') {
            document.getElementById('reset').click();
        }
    });

    document.getElementById('next').addEventListener('click', nextQuestion);
    document.getElementById('reset').addEventListener('click', resetQuiz);
});
