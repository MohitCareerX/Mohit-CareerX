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

  if (!email) {
    return show("msg", "Please enter your email address.", true);
  }

  if (password.length < 6) {
    return show(
      "msg",
      "Use a password with at least 6 characters.",
      true
    );
  }

  /*
   * After email confirmation, Supabase will send the user
   * back to the MOHIT CAREERX homepage.
   */
  const redirectUrl =
    "https://mohitcareerx.github.io/Mohit-CareerX/";

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
      location.href = "dashboard.html";
    }, 600);
  } else {
    show(
      "msg",
      "Account created successfully. Please check your email and click the confirmation link."
    );
  }
}

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

  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    return show("msg", error.message, true);
  }

  const next = new URLSearchParams(location.search).get("next");

  location.href =
    next === "admin.html" ? "admin.html" : "dashboard.html";
}

async function logout() {
  await sb.auth.signOut();
  location.href = "index.html";
}
