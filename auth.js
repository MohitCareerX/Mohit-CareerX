const { createClient } = supabase;

const sb = createClient(
  window.MOHIT_CONFIG.SUPABASE_URL,
  window.MOHIT_CONFIG.SUPABASE_PUBLISHABLE_KEY
);

function configOK() {
  return (
    window.MOHIT_CONFIG.SUPABASE_URL.startsWith("http") &&
    !window.MOHIT_CONFIG.SUPABASE_PUBLISHABLE_KEY.startsWith("YOUR_")
  );
}

function show(id, msg, err = false) {
  const el = document.getElementById(id);
  if (!el) return;

  el.textContent = msg;
  el.className = err ? "notice error" : "notice";
}

/* Safe redirect after login */
function getSafeNext() {
  const raw = new URLSearchParams(window.location.search).get("next");

  if (!raw) return "dashboard.html";

  let next = raw;

  try {
    next = decodeURIComponent(raw);
  } catch (e) {
    return "dashboard.html";
  }

  /* Block external/open redirects */
  if (
    next.startsWith("http://") ||
    next.startsWith("https://") ||
    next.startsWith("//")
  ) {
    return "dashboard.html";
  }

  const cleanPath = next
    .replace(/^\.?\//, "")
    .split(/[?#]/)[0];

  const allowedPages = new Set([
    "index.html",
    "dashboard.html",
    "student-registration.html",
    "our-courses.html",
    "admin.html"
  ]);

  if (!allowedPages.has(cleanPath)) {
    return "dashboard.html";
  }

  return next;
}

/* Signup */
async function signup() {
  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!configOK()) {
    return show(
      "msg",
      "First add your Supabase URL and publishable key in supabase-config.js.",
      true
    );
  }

  if (!name) {
    return show("msg", "Please enter your full name.", true);
  }

  if (password.length < 6) {
    return show(
      "msg",
      "Use a password with at least 6 characters.",
      true
    );
  }

  const redirectUrl = new URL("./", window.location.href).href;

  const { data, error } = await sb.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name
      },
      emailRedirectTo: redirectUrl
    }
  });

  if (error) {
    return show("msg", error.message, true);
  }

  if (data.session) {
    show("msg", "Account created. Redirecting…");
    setTimeout(() => {
      window.location.href = "dashboard.html";
    }, 600);
  } else {
    show(
      "msg",
      "Account created. Please check your email and verify your account."
    );
  }
}

/* Login */
async function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!configOK()) {
    return show(
      "msg",
      "First add your Supabase URL and publishable key in supabase-config.js.",
      true
    );
  }

  if (!email || !password) {
    return show(
      "msg",
      "Please enter email and password.",
      true
    );
  }

  show("msg", "Logging in...");

  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return show("msg", error.message, true);
  }

  if (!data?.session) {
    return show(
      "msg",
      "Login successful, but session was not created. Please try again.",
      true
    );
  }

  const next = getSafeNext();

  show("msg", "Login successful. Redirecting...");

  setTimeout(() => {
    window.location.replace(next);
  }, 300);
}

/* Logout */
async function logout() {
  await sb.auth.signOut();
  window.location.href = "index.html";
}
