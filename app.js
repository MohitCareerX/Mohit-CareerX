// MOHIT CAREERX - Authentication
// Login / Signup / Email Confirmation Redirect

const sb = window.supabase.createClient(
  window.MOHIT_CONFIG.SUPABASE_URL,
  window.MOHIT_CONFIG.SUPABASE_PUBLISHABLE_KEY
);

// Get ?next=... safely
function nextUrl() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");

  // Only allow relative internal pages
  if (
    next &&
    !next.startsWith("http://") &&
    !next.startsWith("https://") &&
    !next.startsWith("//")
  ) {
    return next;
  }

  return "dashboard.html";
}


// =========================
// SIGN UP
// =========================
async function signup() {
  const name = document.getElementById("name")?.value.trim();
  const email = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value;

  if (!email || !password) {
    alert("Please enter email and password.");
    return;
  }

  try {
    const { data, error } = await sb.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          full_name: name || ""
        },
        emailRedirectTo: window.location.origin + "/Mohit-CareerX/"
      }
    });

    if (error) {
      alert(error.message);
      return;
    }

    if (data.session) {
      window.location.href = nextUrl();
      return;
    }

    alert(
      "Account created successfully.\n\n" +
      "Please check your email and confirm your email address."
    );

  } catch (err) {
    console.error(err);
    alert("Something went wrong. Please try again.");
  }
}


// =========================
// LOGIN
// =========================
async function login() {
  const email = document.getElementById("email")?.value.trim();
  const password = document.getElementById("password")?.value;

  if (!email || !password) {
    alert("Please enter email and password.");
    return;
  }

  try {
    const { data, error } = await sb.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      alert(error.message);
      return;
    }

    if (data.session) {
      window.location.href = nextUrl();
    }

  } catch (err) {
    console.error(err);
    alert("Login failed. Please try again.");
  }
}


// =========================
// LOGOUT
// =========================
async function logout() {
  try {
    const { error } = await sb.auth.signOut();

    if (error) {
      alert(error.message);
      return;
    }

    window.location.href = "index.html";

  } catch (err) {
    console.error(err);
    alert("Logout failed.");
  }
}


// =========================
// CHECK CURRENT USER
// =========================
async function getCurrentUser() {
  const {
    data: { user },
    error
  } = await sb.auth.getUser();

  if (error) {
    console.error(error);
    return null;
  }

  return user;
}


// =========================
// AUTO REDIRECT AFTER LOGIN
// =========================
async function requireLogin() {
  const user = await getCurrentUser();

  if (!user) {
    const currentPage =
      window.location.pathname.split("/").pop() +
      window.location.search;

    window.location.href =
      "login.html?next=" + encodeURIComponent(currentPage);

    return null;
  }

  return user;
}


// =========================
// AUTH STATE LISTENER
// =========================
sb.auth.onAuthStateChange((event, session) => {
  console.log("Auth event:", event);

  if (event === "SIGNED_OUT") {
    console.log("User signed out.");
  }

  if (event === "SIGNED_IN" && session?.user) {
    console.log("User signed in:", session.user.email);
  }
});
