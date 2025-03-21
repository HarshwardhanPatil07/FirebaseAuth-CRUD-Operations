import React, { useState, useEffect, createContext, useContext, useRef } from "react";
import {
  BrowserRouter as Router,
  Route,
  Switch,
  Redirect,
  Link,
  useHistory,
} from "react-router-dom";
import { db } from "./firebase-config";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  updateDoc,
  doc,
} from "firebase/firestore";
import bcrypt from "bcryptjs";
import "./App.css";

// Create an AuthContext to share auth state across the app
const AuthContext = createContext();

// PrivateRoute component to restrict access to authenticated users
function PrivateRoute({ component: Component, ...rest }) {
  const { currentUser } = useContext(AuthContext);
  return (
    <Route
      {...rest}
      render={(props) =>
        currentUser ? <Component {...props} /> : <Redirect to="/" />
      }
    />
  );
}

// --- Signup Component ---
function Signup() {
  const history = useHistory();
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [passwordStrength, setPasswordStrength] = useState("");

  // Validate email: simple check for "@" and ending with ".com"
  const validateEmail = (email) => {
    return email.includes("@") && email.endsWith(".com");
  };

  // Password validation: must contain at least one lowercase letter,
  // one uppercase letter, one digit, and be at least 6 characters long.
  const validatePassword = (pass) => {
    const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/;
    return re.test(pass);
  };

  // Display a basic strength indicator based on length and pattern.
  const checkPasswordStrength = (pass) => {
    if (!validatePassword(pass)) {
      setPasswordStrength("Weak");
    } else if (pass.length < 10) {
      setPasswordStrength("Moderate");
    } else {
      setPasswordStrength("Strong");
    }
  };

  const handleSignup = async () => {
    setError("");
    if (!validateEmail(email)) {
      setError("Invalid email. It must include '@' and end with '.com'.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!validatePassword(password)) {
      setError(
        "Password must include at least one uppercase letter, one lowercase letter, one number, and be at least 6 characters long."
      );
      return;
    }

    // Check if user already exists in Firestore
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      setError("User with this email already exists.");
      return;
    }

    // Hash the password with bcrypt before storing
    const saltRounds = 10;
    const hashedPassword = bcrypt.hashSync(password, saltRounds);

    try {
      await addDoc(usersRef, {
        name,
        age: Number(age),
        email,
        password: hashedPassword,
      });
      alert("Signup successful! Please login.");
      history.push("/");
    } catch (err) {
      setError("Error signing up: " + err.message);
    }
  };

  return (
    <div className="auth-container">
      <h2>Sign Up</h2>
      {error && <p className="error">{error}</p>}
      <input
        type="text"
        placeholder="Name..."
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="number"
        placeholder="Age..."
        value={age}
        onChange={(e) => setAge(e.target.value)}
      />
      <input
        type="email"
        placeholder="Email..."
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password..."
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          checkPasswordStrength(e.target.value);
        }}
      />
      {password && (
        <div style={{ textAlign: "left", margin: "0.5rem 0" }}>
          <small>Password Strength: {passwordStrength}</small>
        </div>
      )}
      <input
        type="password"
        placeholder="Confirm Password..."
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
      />
      <button onClick={handleSignup}>Sign Up</button>
      <p>
        Already have an account? <Link to="/">Login</Link>
      </p>
    </div>
  );
}

// --- Login Component ---
function Login() {
  const history = useHistory();
  const { setCurrentUser } = useContext(AuthContext);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Reuse the same simple email validation as in Signup
  const validateEmail = (email) => {
    return email.includes("@") && email.endsWith(".com");
  };

  const handleLogin = async () => {
    setError("");
    if (!validateEmail(email)) {
      setError("Invalid email. It must include '@' and end with '.com'.");
      return;
    }
    // Query Firestore for the user with the given email
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      setError("Invalid email or password.");
      return;
    }
    // Assume email is unique, so take the first result
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    // Use bcrypt to compare the entered password with the hashed password
    if (!bcrypt.compareSync(password, userData.password)) {
      setError("Invalid email or password.");
      return;
    }
    // Login successful: update auth state and persist user to localStorage
    const user = { id: userDoc.id, ...userData };
    setCurrentUser(user);
    localStorage.setItem("currentUser", JSON.stringify(user));
    history.push("/dashboard");
  };

  return (
    <div className="auth-container">
      <h2>Login</h2>
      {error && <p className="error">{error}</p>}
      <input
        type="email"
        placeholder="Email..."
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        type="password"
        placeholder="Password..."
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={handleLogin}>Login</button>
      <p>
        Don't have an account? <Link to="/signup">Sign Up</Link>
      </p>
    </div>
  );
}

// --- EditProfile Component ---
// This new component allows the user to update their name and age.
function EditProfile() {
  const { currentUser, setCurrentUser } = useContext(AuthContext);
  const [name, setName] = useState(currentUser?.name || "");
  const [age, setAge] = useState(currentUser?.age || "");
  const [message, setMessage] = useState("");
  const history = useHistory();

  const handleUpdate = async () => {
    if (!name || !age) {
      setMessage("Name and age cannot be empty.");
      return;
    }
    // Create a reference to the user's document in Firestore
    const userDocRef = doc(db, "users", currentUser.id);
    try {
      // Update the document with new name and age values
      await updateDoc(userDocRef, {
        name: name,
        age: Number(age),
      });
      // Update local auth state and localStorage
      const updatedUser = { ...currentUser, name: name, age: Number(age) };
      setCurrentUser(updatedUser);
      localStorage.setItem("currentUser", JSON.stringify(updatedUser));
      setMessage("Profile updated successfully!");
      history.push("/dashboard");
    } catch (err) {
      setMessage("Error updating profile: " + err.message);
    }
  };

  return (
    <div className="auth-container">
      <h2>Edit Profile</h2>
      {message && <p>{message}</p>}
      <input
        type="text"
        placeholder="Name..."
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        type="number"
        placeholder="Age..."
        value={age}
        onChange={(e) => setAge(e.target.value)}
      />
      <button onClick={handleUpdate}>Update Profile</button>
      <p>
        <Link to="/dashboard">Cancel</Link>
      </p>
    </div>
  );
}

// --- MarioGame Component (Simple Mario-inspired Platformer) ---
function MarioGame() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animationFrameId;
    const keys = {};
    const groundY = canvas.height - 50;

    // Mario object with basic physics properties
    const mario = {
      x: 50,
      y: 0,
      width: 32,
      height: 32,
      vx: 0,
      vy: 0,
      onGround: false,
    };
    const gravity = 0.5;
    const friction = 0.9;

    const gameLoop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Handle controls
      if (keys["ArrowLeft"]) {
        mario.vx = -5;
      }
      if (keys["ArrowRight"]) {
        mario.vx = 5;
      }
      if (keys[" "] && mario.onGround) {
        mario.vy = -12;
        mario.onGround = false;
      }

      // Apply gravity and friction
      mario.vy += gravity;
      mario.x += mario.vx;
      mario.y += mario.vy;
      mario.vx *= friction;

      // Collision with ground
      if (mario.y + mario.height > groundY) {
        mario.y = groundY - mario.height;
        mario.vy = 0;
        mario.onGround = true;
      }

      // Boundaries
      if (mario.x < 0) mario.x = 0;
      if (mario.x + mario.width > canvas.width)
        mario.x = canvas.width - mario.width;

      // Draw ground (neon cyan)
      ctx.fillStyle = "#00ffff";
      ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);

      // Draw Mario (neon pink)
      ctx.fillStyle = "#ff00ff";
      ctx.fillRect(mario.x, mario.y, mario.width, mario.height);

      // Draw instructions
      ctx.fillStyle = "#fff";
      ctx.font = "16px sans-serif";
      ctx.fillText("Left/Right: Move | Space: Jump", 10, 20);

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    const keyDownHandler = (e) => {
      keys[e.key] = true;
    };

    const keyUpHandler = (e) => {
      keys[e.key] = false;
    };

    window.addEventListener("keydown", keyDownHandler);
    window.addEventListener("keyup", keyUpHandler);

    gameLoop();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("keydown", keyDownHandler);
      window.removeEventListener("keyup", keyUpHandler);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={400}
      style={{
        border: "2px solid #39ff14",
        background: "rgba(0, 0, 0, 0.85)",
        display: "block",
        margin: "20px auto",
      }}
    />
  );
}

// --- Dashboard Component (Protected) ---
function Dashboard() {
  const { currentUser, setCurrentUser } = useContext(AuthContext);
  const history = useHistory();

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("currentUser");
    history.push("/");
  };

  return (
    <div className="dashboard">
      <h2>Welcome, {currentUser && currentUser.name}!</h2>
      <p>You have access to this restricted dashboard.</p>
      <button onClick={handleLogout}>Logout</button>
      {/* Link to the Edit Profile page */}
      <Link to="/edit-profile" style={{ marginLeft: "10px" }}>
        Edit Profile
      </Link>
      <hr />
      <h3 className="neon-text">Mario Platformer</h3>
      <MarioGame />
    </div>
  );
}

// --- Main App Component with Authentication State Observer ---
function App() {
  const [currentUser, setCurrentUser] = useState(null);

  // On mount, check localStorage for an authenticated user
  useEffect(() => {
    const storedUser = localStorage.getItem("currentUser");
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser }}>
      <Router>
        <div className="App">
          <Switch>
            <Route exact path="/" component={Login} />
            <Route path="/signup" component={Signup} />
            <PrivateRoute path="/dashboard" component={Dashboard} />
            <PrivateRoute path="/edit-profile" component={EditProfile} />
          </Switch>
        </div>
      </Router>
    </AuthContext.Provider>
  );
}

export default App;
