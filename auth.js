const { createClient } = supabase;

const sb = createClient(
  window.MOHIT_CONFIG.SUPABASE_URL,
  window.MOHIT_CONFIG.SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce"
    }
  }
);

function configOK() {
  return (
    window.MOHIT_CONFIG?.SUPABASE_URL?.startsWith("http") &&
    window.MOHIT_CONFIG?.SUPABASE_PUBLISHABLE_KEY &&
    !window.MOHIT_CONFIG.SUPABASE_PUBLISHABLE_KEY.startsWith("YOUR_")
  );
}

function show(id, msg, err = false) {
  const el = document.getElementById(id);

  if (!el) return;

  el.textContent = msg;
  el.className = err
    ? "notice error"
    : "notice";
}

/* =========================================================
   SIGN UP
========================================================= */

async function signup() {
  const name =
    document.getElementById("name")?.value.trim();

  const email =
    document.getElementById("email")?.value.trim();

  const password =
    document.getElementById("password")?.value;

  if (!configOK()) {
    return show(
      "msg",
      "Supabase configuration missing.",
      true
    );
  }

  if (!name) {
    return show(
      "msg",
      "Please enter your name.",
      true
    );
  }

  if (!email) {
    return show(
      "msg",
      "Please enter your email.",
      true
    );
  }

  if (!password || password.length < 6) {
    return show(
      "msg",
      "Use a password with at least 6 characters.",
      true
    );
  }

  try {
    const redirectUrl =
      new URL("./", window.location.href).href;

    const {
      data,
      error
    } = await sb.auth.signUp({
      email,
      password,

      options: {
        data: {
          full_name: name
        },

        emailRedirectTo:
          redirectUrl
      }
    });

    if (error) {
      throw error;
    }

    if (data?.session) {
      show(
        "msg",
        "Account created. Redirecting..."
      );

      setTimeout(() => {
        goToNextPage();
      }, 500);

      return;
    }

    show(
      "msg",
      "Account created. Please check your email and verify your account."
    );

  } catch (error) {
    console.error(
      "Signup error:",
      error
    );

    show(
      "msg",
      error.message ||
        "Signup failed.",
      true
    );
  }
}

/* =========================================================
   LOGIN
========================================================= */

async function login() {
  const email =
    document.getElementById("email")?.value.trim();

  const password =
    document.getElementById("password")?.value;

  if (!configOK()) {
    return show(
      "msg",
      "Supabase configuration missing.",
      true
    );
  }

  if (!email) {
    return show(
      "msg",
      "Please enter your email.",
      true
    );
  }

  if (!password) {
    return show(
      "msg",
      "Please enter your password.",
      true
    );
  }

  try {
    show(
      "msg",
      "Logging in..."
    );

    const {
      data,
      error
    } = await sb.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    if (!data?.session?.user) {
      throw new Error(
        "Login succeeded but no auth session was created."
      );
    }

    console.log(
      "Login successful:",
      data.session.user.email
    );

    /*
      IMPORTANT:
      Give Supabase a moment to persist the session.
    */

    await new Promise(
      resolve => setTimeout(resolve, 300)
    );

    const {
      data: sessionCheck
    } = await sb.auth.getSession();

    if (!sessionCheck?.session) {
      throw new Error(
        "Login session could not be saved. Please try again."
      );
    }

    show(
      "msg",
      "Login successful. Redirecting..."
    );

    setTimeout(() => {
      goToNextPage();
    }, 400);

  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    show(
      "msg",
      error.message ||
        "Login failed.",
      true
    );
  }
}

/* =========================================================
   NEXT PAGE
========================================================= */

function goToNextPage() {
  const params =
    new URLSearchParams(
      window.location.search
    );

  const next =
    params.get("next");

  /*
    Allow internal pages only.
    Prevent external URL redirects.
  */

  const allowedPages = [
    "index.html",
    "dashboard.html",
    "admin.html",
    "student-registration.html",
    "our-courses.html"
  ];

  let destination =
    "dashboard.html";

  if (next) {
    try {
      const decoded =
        decodeURIComponent(next);

      /*
        Only allow internal HTML paths.
      */

      if (
        allowedPages.includes(
          decoded.split("?")[0]
        )
      ) {
        destination =
          decoded;
      }
    } catch (error) {
      console.warn(
        "Invalid next URL:",
        error
      );
    }
  }

  window.location.href =
    destination;
}

/* =========================================================
   LOGOUT
========================================================= */

async function logout() {
  try {
    await sb.auth.signOut();

    window.location.href =
      "index.html";

  } catch (error) {
    console.error(
      "Logout error:",
      error
    );
  }
}
