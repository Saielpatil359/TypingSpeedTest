import React, { useState, useEffect, useRef } from "react";

const API_BASE = "https://typing-quest.onrender.com"; 

const ACHIEVEMENTS = [
  { name: "Beginner", minWPM: 0, maxWPM: 39, className: "beginner" },
  { name: "Pro", minWPM: 40, maxWPM: 69, className: "pro" },
  { name: "Advanced", minWPM: 70, maxWPM: Infinity, className: "advanced" }
];

const DEFAULT_TIME = 90;

export default function TypingTest() {
  const [duration, setDuration] = useState(DEFAULT_TIME);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_TIME);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [chars, setChars] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [keystrokes, setKeystrokes] = useState(0);
  const [currentTextId, setCurrentTextId] = useState(null);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [achievement, setAchievement] = useState("-");
  const [achievementClass, setAchievementClass] = useState("");
  const [userName, setUserName] = useState(localStorage.getItem("typeflow-user-name") || "");
  const timerIdRef = useRef(null);
  const promptRef = useRef(null);
  const hiddenInputRef = useRef(null);

  useEffect(() => {
    // Save username to localStorage when it changes
    localStorage.setItem("typeflow-user-name", userName);
  }, [userName]);

  useEffect(() => {
    // Fetch initial text based on duration when component mounts or duration changes
    resetState();
  }, [duration]);

  useEffect(() => {
    // Start or stop timer accordingly
    if (started && !finished && !timerIdRef.current) {
      const endTime = performance.now() + duration * 1000;
      timerIdRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.round((endTime - performance.now()) / 1000));
        setTimeLeft(remaining);
        updateStats();
        if (remaining <= 0) finishTest();
      }, 200);
    }
    return () => {
      clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    };
  }, [started, finished]);

  const fetchTextForDuration = async (d) => {
    try {
      const res = await fetch(`${API_BASE}/api/texts?duration=${d}`, { cache: "no-store" });
      if (!res.ok) throw new Error("No text available for this duration");
      const data = await res.json();
      setCurrentTextId(data.id);
      return data.content;
    } catch (e) {
      console.error(e);
      return "No text available for this duration. Please add some texts in your backend.";
    }
  };

  const renderPrompt = (text) => {
    const spans = text.split("").map((char, i) => {
      return { char, status: i === 0 ? "active" : "pending" };
    });
    setChars(spans);
    setCurrentIndex(0);
  };

  const resetState = async () => {
    if(timerIdRef.current){
      clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    }
    setStarted(false);
    setFinished(false);
    setCorrectCount(0);
    setKeystrokes(0);
    setTimeLeft(duration);
    setWpm(0);
    setAccuracy(100);
    setAchievement("-");
    setAchievementClass("");
    setCurrentIndex(0);

    const text = await fetchTextForDuration(duration);
    renderPrompt(text);
    if(hiddenInputRef.current) hiddenInputRef.current.value="";
  };

  const calcWPM = () => {
    const elapsed = Math.max(1, duration - timeLeft);
    return Math.max(0, Math.round((correctCount / 5) / (elapsed / 60)));
  };

  const calcAccuracy = () => {
    return Math.round((correctCount / (keystrokes || 1)) * 100);
  };

  const updateAchievement = (wpmValue) => {
    const tier = ACHIEVEMENTS.find(a => wpmValue >= a.minWPM && wpmValue <= a.maxWPM);
    if (tier) {
      setAchievement(tier.name);
      setAchievementClass(tier.className);
    }
  };

  const updateStats = () => {
    const newWpm = calcWPM();
    const newAcc = calcAccuracy();
    setWpm(newWpm);
    setAccuracy(newAcc);
    updateAchievement(newWpm);
  };

  const submitResult = async () => {
    if (!currentTextId) return;
    const payload = {
      user_id: userName.trim() || null,
      duration,
      wpm: calcWPM(),
      accuracy: calcAccuracy(),
      correct_chars: correctCount,
      raw_keystrokes: keystrokes,
      text_id: currentTextId
    };
    try {
      await fetch(`${API_BASE}/api/results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch (e) {
      console.error("Result submit failed", e);
    }
  };

  const finishTest = () => {
    setFinished(true);
    if(timerIdRef.current){
      clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    }
    updateStats();
    submitResult();
  };

  const handleInput = (e) => {
    if(finished) return;

    const val = e.data;
    const key = e.inputType;

    if(!started){
      setStarted(true);
    }

    if(key === "insertText" && val?.length === 1){
      if(currentIndex >= chars.length) return;
      setKeystrokes(prev => prev + 1);
      const expected = chars[currentIndex].char;
      if(val === expected){
        chars[currentIndex].status = "correct";
        setCorrectCount(prev => prev + 1);
      } else {
        chars[currentIndex].status = "incorrect";
      }
      // Move to next char
      chars[currentIndex].status = chars[currentIndex].status.replace("active", "").trim();
      const nextIndex = currentIndex + 1;
      if(nextIndex < chars.length) {
        chars[nextIndex].status = "active";
      }
      setCurrentIndex(nextIndex);
      setChars([...chars]);
    } else if(key === "deleteContentBackward") {
      if(currentIndex > 0){
        const prevIndex = currentIndex - 1;
        chars[prevIndex].status = "pending active";
        setCurrentIndex(prevIndex);
        setKeystrokes(prev => prev + 1);
        setChars([...chars]);
      }
    }
    if(hiddenInputRef.current) hiddenInputRef.current.value = "";
    updateStats();
    if(currentIndex >= chars.length){
      finishTest();
    }
  };

  const focusTyping = () => {
    if(hiddenInputRef.current) hiddenInputRef.current.focus({ preventScroll: true });
  };

  return (
    <div className="typing-test">
      <div id="prompt" ref={promptRef} style={{fontFamily:"monospace", fontSize:"18px", whiteSpace:"pre-wrap"}}>
        {chars.map((c,i) => (
          <span key={i} className={`char ${c.status}`}>
            {c.char}
          </span>
        ))}
      </div>
      <div className="stats">
        <div>Time Left: <span id="time">{timeLeft}</span></div>
        <div>WPM: <span id="wpm">{wpm}</span></div>
        <div>Accuracy: <span id="accuracy">{accuracy}%</span></div>
        <div>Achievement: <span id="achievementBadge" className={`badge ${achievementClass}`} style={{display: achievementClass ? "inline-block" : "none"}}>{achievement}</span></div>
      </div>
      <div 
        id="textArea"
        tabIndex={0}
        style={{border:"1px solid #ccc", height:"150px", margin:"10px 0", padding:"8px", cursor:"text", outline:"none"}}
        onClick={focusTyping}
      >
        Click here to start typing...
      </div>
      <input 
        id="hiddenInput" 
        type="text" 
        autoComplete="off" 
        spellCheck="false" 
        style={{opacity:0, position:"absolute", left:"-9999px"}} 
        ref={hiddenInputRef} 
        onBeforeInput={handleInput}
        onPaste={(e) => e.preventDefault()}
      />
      <input 
        id="userNameInput" 
        type="text" 
        placeholder="Enter your name" 
        value={userName} 
        onChange={(e) => setUserName(e.target.value)} 
        style={{margin:"10px 0", padding:"5px"}}
      />
      <div className="controls">
        {[30, 60, 90].map(t => 
          <button 
            key={t} 
            className={`time-chip ${duration === t ? "active" : ""}`} 
            onClick={() => setDuration(t)}
          >
            {t} sec
          </button>
        )}
        <button id="restartBtn" onClick={resetState}>Restart</button>
      </div>
    </div>
  )
}
