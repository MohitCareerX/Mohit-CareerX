/* =========================================================
   MOHIT CAREERX
   Student Registration System
   Final Version
   Auth + Course + Coupon + Private Upload + Enrollment
   ========================================================= */

const { createClient } = supabase;

/* ---------------------------------------------------------
   Supabase Client
--------------------------------------------------------- */

if (
  !window.MOHIT_CONFIG?.SUPABASE_URL ||
  !window.MOHIT_CONFIG?.SUPABASE_PUBLISHABLE_KEY
) {
  throw new Error("Supabase configuration is missing.");
}

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

/* ---------------------------------------------------------
   Helpers
--------------------------------------------------------- */

const $ = (id) => document.getElementById(id);

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };

    return map[char];
  });
}

function showMessage(message, type = "info") {
  const el = $("msg");

  if (!el) return;

  el.textContent = message;

  el.className =
    type === "error"
      ? "notice error"
      : type === "success"
      ? "notice success"
      : "notice";
}

function showAuthNotice(message, error = false) {
  const el = $("authNotice");

  if (!el) return;

  el.textContent = message;

  el.className = error
    ? "notice error"
    : "notice";
}

function formatINR(amount) {
  const number = Number(amount || 0);

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(number);
}

/* ---------------------------------------------------------
   Global State
--------------------------------------------------------- */

let currentUser = null;
let courses = [];

let currentCourseFee = 0;

let appliedCoupon = null;
let appliedDiscountPercent = 0;

/* ---------------------------------------------------------
   Get Logged-in User
   IMPORTANT:
   We first check existing session.
   If missing, we wait for auth state.
--------------------------------------------------------- */

async function getLoggedInUser() {
  try {
    /* ---------------------------------------------
       STEP 1: Existing browser session
    --------------------------------------------- */

    const {
      data: sessionData,
      error: sessionError
    } = await sb.auth.getSession();

    if (sessionError) {
      console.error("getSession error:", sessionError);
    }

    if (sessionData?.session?.user) {
      return sessionData.session.user;
    }

    /* ---------------------------------------------
       STEP 2: Give Supabase a moment to restore
       persisted session
    --------------------------------------------- */

    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });

    const {
      data: retryData,
      error: retryError
    } = await sb.auth.getSession();

    if (retryError) {
      console.error("Retry getSession error:", retryError);
    }

    if (retryData?.session?.user) {
      return retryData.session.user;
    }

    /* ---------------------------------------------
       STEP 3: getUser fallback
    --------------------------------------------- */

    const {
      data: userData,
      error: userError
    } = await sb.auth.getUser();

    if (!userError && userData?.user) {
      return userData.user;
    }

    return null;
  } catch (error) {
    console.error("getLoggedInUser error:", error);
    return null;
  }
}

/* ---------------------------------------------------------
   Auth State Listener
--------------------------------------------------------- */

let authResolved = false;

sb.auth.onAuthStateChange((event, session) => {
  console.log("Auth event:", event);

  if (session?.user) {
    currentUser = session.user;
    authResolved = true;

    const emailField = $("email");

    if (emailField) {
      emailField.value = session.user.email || "";
    }

    showAuthNotice(
      `Logged in as ${session.user.email || "user"}`
    );

    const form = $("studentForm");

    if (form) {
      form.style.display = "block";
    }

    return;
  }

  if (
    event === "SIGNED_OUT" ||
    event === "INITIAL_SESSION"
  ) {
    if (!session?.user) {
      authResolved = true;
    }
  }
});

/* ---------------------------------------------------------
   Redirect to Login
--------------------------------------------------------- */

function redirectToLogin() {
  const courseId =
    new URLSearchParams(window.location.search).get("course");

  let loginUrl = "login.html";

  if (courseId) {
    loginUrl +=
      "?next=" +
      encodeURIComponent(
        "student-registration.html?course=" +
          encodeURIComponent(courseId)
      );
  } else {
    loginUrl +=
      "?next=" +
      encodeURIComponent("student-registration.html");
  }

  window.location.href = loginUrl;
}

/* ---------------------------------------------------------
   Private File Upload
--------------------------------------------------------- */

async function uploadPrivateFile(file, folder) {
  if (!file) return null;

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf"
  ];

  if (!allowedTypes.includes(file.type)) {
    throw new Error(
      "Only JPG, PNG, WEBP or PDF files are allowed."
    );
  }

  const maxSize =
    folder === "photos"
      ? 5 * 1024 * 1024
      : 10 * 1024 * 1024;

  if (file.size > maxSize) {
    throw new Error(
      folder === "photos"
        ? "Photo size must be 5 MB or less."
        : "Document size must be 10 MB or less."
    );
  }

  if (!currentUser?.id) {
    throw new Error(
      "Login session is missing. Please login again."
    );
  }

  const extension =
    file.name.split(".").pop()?.toLowerCase() || "file";

  const randomPart =
    crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  const filePath =
    `${currentUser.id}/${folder}/${Date.now()}-${randomPart}.${extension}`;

  const {
    data,
    error
  } = await sb.storage
    .from("student-private")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false
    });

  if (error) {
    throw error;
  }

  return data?.path || filePath;
}

/* ---------------------------------------------------------
   Delete Private Uploaded Files
--------------------------------------------------------- */

async function deletePrivateFile(path) {
  if (!path) return;

  try {
    await sb.storage
      .from("student-private")
      .remove([path]);
  } catch (error) {
    console.warn(
      "Could not delete uploaded file:",
      error
    );
  }
}

/* ---------------------------------------------------------
   Load Courses
--------------------------------------------------------- */

async function loadCourses() {
  const courseSelect = $("course_id");

  if (!courseSelect) {
    return;
  }

  courseSelect.innerHTML =
    '<option value="">Loading courses...</option>';

  const {
    data,
    error
  } = await sb
    .from("courses")
    .select(
      "id,code,name,description,duration_months,fee_inr,active"
    )
    .eq("active", true)
    .order("name");

  if (error) {
    console.error("Course loading error:", error);

    courseSelect.innerHTML =
      '<option value="">Unable to load courses</option>';

    showMessage(
      "Courses load नहीं हो पाए: " + error.message,
      "error"
    );

    return;
  }

  courses = data || [];

  if (!courses.length) {
    courseSelect.innerHTML =
      '<option value="">No active courses available</option>';

    return;
  }

  courseSelect.innerHTML =
    '<option value="">Select Course</option>' +
    courses
      .map(
        (course) => `
          <option value="${esc(course.id)}">
            ${esc(course.code)} - ${esc(course.name)}
            ${Number(course.fee_inr || 0) > 0
              ? " — " + formatINR(course.fee_inr)
              : " — FREE"}
          </option>
        `
      )
      .join("");

  /* ---------------------------------------------
     Course from URL
  --------------------------------------------- */

  const params =
    new URLSearchParams(window.location.search);

  const urlCourseId =
    params.get("course");

  if (urlCourseId) {
    const exists = courses.some(
      (course) => course.id === urlCourseId
    );

    if (exists) {
      courseSelect.value = urlCourseId;
    }
  }

  updateSelectedCourseFee();
}

/* ---------------------------------------------------------
   Get Selected Course
--------------------------------------------------------- */

function getSelectedCourse() {
  const courseId =
    $("course_id")?.value;

  if (!courseId) {
    return null;
  }

  return (
    courses.find(
      (course) => course.id === courseId
    ) || null
  );
}

/* ---------------------------------------------------------
   Fee Summary
--------------------------------------------------------- */

function updateFeeSummary() {
  const feeSummary = $("feeSummary");

  const originalFeeEl =
    $("originalFee");

  const discountAmountEl =
    $("discountAmount");

  const payableAmountEl =
    $("payableAmount");

  if (!feeSummary) return;

  const fee =
    Number(currentCourseFee || 0);

  const discount =
    appliedDiscountPercent > 0
      ? Math.round(
          (fee * appliedDiscountPercent) / 100
        )
      : 0;

  const payable =
    Math.max(0, fee - discount);

  if (originalFeeEl) {
    originalFeeEl.textContent =
      formatINR(fee);
  }

  if (discountAmountEl) {
    discountAmountEl.textContent =
      formatINR(discount);
  }

  if (payableAmountEl) {
    payableAmountEl.textContent =
      formatINR(payable);
  }

  feeSummary.style.display = "block";
}

/* ---------------------------------------------------------
   Course Change
--------------------------------------------------------- */

function updateSelectedCourseFee() {
  const course =
    getSelectedCourse();

  if (!course) {
    currentCourseFee = 0;
    updateFeeSummary();
    return;
  }

  currentCourseFee =
    Number(course.fee_inr || 0);

  /* Coupon is reset when course changes */
  appliedCoupon = null;
  appliedDiscountPercent = 0;

  const couponInput =
    $("coupon_code");

  const couponMsg =
    $("couponMsg");

  if (couponInput) {
    couponInput.value = "";
  }

  if (couponMsg) {
    couponMsg.textContent = "";
  }

  updateFeeSummary();
}

/* ---------------------------------------------------------
   Reset Coupon
--------------------------------------------------------- */

function resetCoupon() {
  appliedCoupon = null;
  appliedDiscountPercent = 0;

  const couponInput =
    $("coupon_code");

  const couponMsg =
    $("couponMsg");

  if (couponInput) {
    couponInput.value = "";
  }

  if (couponMsg) {
    couponMsg.textContent = "";
    couponMsg.className = "";
  }

  updateFeeSummary();
}

/* ---------------------------------------------------------
   Apply Coupon
--------------------------------------------------------- */

async function applyCoupon() {
  const input =
    $("coupon_code");

  const button =
    $("applyCouponBtn");

  const message =
    $("couponMsg");

  const course =
    getSelectedCourse();

  if (!input || !message) {
    return;
  }

  const code =
    input.value.trim().toUpperCase();

  if (!course) {
    message.textContent =
      "Please select a course first.";

    message.className =
      "notice error";

    return;
  }

  if (!code) {
    message.textContent =
      "Please enter a coupon code.";

    message.className =
      "notice error";

    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Checking...";
  }

  message.textContent =
    "Checking coupon...";

  message.className =
    "notice";

  try {
    const {
      data,
      error
    } = await sb.rpc(
      "get_coupon_discount",
      {
        p_code: code
      }
    );

    if (error) {
      console.error(
        "Coupon RPC error:",
        error
      );

      throw error;
    }

    console.log(
      "Coupon RPC response:",
      data
    );

    /* ---------------------------------------------
       Handle scalar / object / array responses
    --------------------------------------------- */

    let discountPercent = 0;

    if (typeof data === "number") {
      discountPercent = Number(data);
    } else if (typeof data === "string") {
      discountPercent = Number(data);
    } else if (Array.isArray(data)) {
      const first = data[0];

      if (typeof first === "number") {
        discountPercent =
          Number(first);
      } else if (
        typeof first === "string"
      ) {
        discountPercent =
          Number(first);
      } else if (first) {
        discountPercent =
          Number(
            first.discount_percent ??
            first.get_coupon_discount ??
            first.discount ??
            0
          );
      }
    } else if (data && typeof data === "object") {
      discountPercent =
        Number(
          data.discount_percent ??
          data.get_coupon_discount ??
          data.discount ??
          0
        );
    }

    if (
      !Number.isFinite(discountPercent) ||
      discountPercent <= 0
    ) {
      resetCoupon();

      message.textContent =
        "Invalid, expired or inactive coupon code.";

      message.className =
        "notice error";

      return;
    }

    appliedCoupon = code;

    appliedDiscountPercent =
      Math.min(
        100,
        Math.max(
          0,
          discountPercent
        )
      );

    updateFeeSummary();

    message.textContent =
      `Coupon applied successfully — ${appliedDiscountPercent}% discount.`;

    message.className =
      "notice success";
  } catch (error) {
    console.error(
      "Apply coupon error:",
      error
    );

    resetCoupon();

    message.textContent =
      "Coupon apply नहीं हो पाया: " +
      (error.message || "Unknown error");

    message.className =
      "notice error";
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent =
        "Apply Coupon";
    }
  }
}

/* ---------------------------------------------------------
   Calculate Payment Amounts
--------------------------------------------------------- */

function calculateAmounts() {
  const fee =
    Number(currentCourseFee || 0);

  const discount =
    appliedDiscountPercent > 0
      ? Math.round(
          (fee * appliedDiscountPercent) / 100
        )
      : 0;

  const payable =
    Math.max(
      0,
      fee - discount
    );

  return {
    fee,
    discount,
    payable
  };
}

/* ---------------------------------------------------------
   Load Registration Page
--------------------------------------------------------- */

async function loadRegistration() {
  try {
    showAuthNotice(
      "Checking login session..."
    );

    const form =
      $("studentForm");

    if (form) {
      form.style.display = "none";
    }

    /* ---------------------------------------------
       Wait for persisted auth session
    --------------------------------------------- */

    currentUser =
      await getLoggedInUser();

    /* ---------------------------------------------
       No session
    --------------------------------------------- */

    if (!currentUser) {
      showAuthNotice(
        "Login session नहीं मिली. Please login first.",
        true
      );

      showMessage(
        "Please login first, then come back to registration.",
        "error"
      );

      /* Give auth state listener a final chance */
      await new Promise(
        (resolve) =>
          setTimeout(resolve, 800)
      );

      if (!currentUser) {
        const loginButton =
          document.createElement("button");

        loginButton.type =
          "button";

        loginButton.className =
          "btn primary";

        loginButton.textContent =
          "🔐 Login Now";

        loginButton.style.marginTop =
          "12px";

        loginButton.onclick =
          redirectToLogin;

        const authNotice =
          $("authNotice");

        if (authNotice) {
          authNotice.appendChild(
            document.createElement("br")
          );

          authNotice.appendChild(
            loginButton
          );
        }

        return;
      }
    }

    /* ---------------------------------------------
       User found
    --------------------------------------------- */

    if (!currentUser) {
      throw new Error(
        "Auth session missing. Please login again."
      );
    }

    const emailField =
      $("email");

    if (emailField) {
      emailField.value =
        currentUser.email || "";
    }

    showAuthNotice(
      `Logged in as ${currentUser.email || "user"}`
    );

    if (form) {
      form.style.display =
        "block";
    }

    /* ---------------------------------------------
       Load Courses
    --------------------------------------------- */

    await loadCourses();

  } catch (error) {
    console.error(
      "Registration initialization error:",
      error
    );

    showAuthNotice(
      "Login check failed: " +
        (error.message || error),
      true
    );

    showMessage(
      "Please refresh the page and login again.",
      "error"
    );
  }
}

/* ---------------------------------------------------------
   Submit Registration
--------------------------------------------------------- */

async function submitRegistration(
  event
) {
  event.preventDefault();

  if (!currentUser) {
    currentUser =
      await getLoggedInUser();
  }

  if (!currentUser) {
    showMessage(
      "Login session missing. Please login again.",
      "error"
    );

    redirectToLogin();

    return;
  }

  const form =
    $("studentForm");

  if (!form) {
    return;
  }

  const submitButton =
    form.querySelector(
      'button[type="submit"]'
    );

  if (submitButton) {
    submitButton.disabled =
      true;

    submitButton.textContent =
      "Submitting...";
  }

  showMessage(
    "Registration submit हो रही है..."
  );

  let photoPath = null;
  let documentPath = null;
  let studentId = null;
  let enrollmentId = null;

  try {
    /* ---------------------------------------------
       Form Values
    --------------------------------------------- */

    const fullName =
      $("full_name")?.value.trim();

    const fatherName =
      $("father_name")?.value.trim();

    const motherName =
      $("mother_name")?.value.trim();

    const gender =
      $("gender")?.value || null;

    const dateOfBirth =
      $("date_of_birth")?.value || null;

    const mobile =
      $("mobile")?.value.trim();

    const email =
      currentUser.email ||
      $("email")?.value.trim();

    const aadhaarNumber =
      $("aadhaar_number")?.value.trim();

    const courseId =
      $("course_id")?.value;

    const qualification =
      $("qualification")?.value.trim();

    const state =
      $("state")?.value.trim();

    const district =
      $("district")?.value.trim();

    const pinCode =
      $("pin_code")?.value.trim();

    const address =
      $("address")?.value.trim();

    const photoFile =
      $("photo")?.files?.[0];

    const documentFile =
      $("document")?.files?.[0];

    /* ---------------------------------------------
       Required Validation
    --------------------------------------------- */

    if (!fullName) {
      throw new Error(
        "Full Name is required."
      );
    }

    if (!mobile) {
      throw new Error(
        "Mobile number is required."
      );
    }

    if (!courseId) {
      throw new Error(
        "Please select a course."
      );
    }

    if (!aadhaarNumber) {
      throw new Error(
        "Aadhaar number is required."
      );
    }

    if (!photoFile) {
      throw new Error(
        "Please upload your photo."
      );
    }

    if (!documentFile) {
      throw new Error(
        "Please upload your document."
      );
    }

    const course =
      courses.find(
        (item) =>
          item.id === courseId
      );

    if (!course) {
      throw new Error(
        "Selected course could not be found."
      );
    }

    /* ---------------------------------------------
       Amount Calculation
    --------------------------------------------- */

    currentCourseFee =
      Number(course.fee_inr || 0);

    const {
      fee,
      discount,
      payable
    } = calculateAmounts();

    /* ---------------------------------------------
       Upload Photo
    --------------------------------------------- */

    showMessage(
      "Photo upload हो रही है..."
    );

    photoPath =
      await uploadPrivateFile(
        photoFile,
        "photos"
      );

    /* ---------------------------------------------
       Upload Document
    --------------------------------------------- */

    showMessage(
      "Document upload हो रहा है..."
    );

    documentPath =
      await uploadPrivateFile(
        documentFile,
        "documents"
      );

    /* ---------------------------------------------
       Create Student
    --------------------------------------------- */

    showMessage(
      "Student registration save हो रही है..."
    );

    const {
      data: student,
      error: studentError
    } = await sb
      .from("students")
      .insert({
        user_id:
          currentUser.id,

        auth_user_id:
          currentUser.id,

        full_name:
          fullName,

        student_name:
          fullName,

        father_name:
          fatherName || null,

        mother_name:
          motherName || null,

        gender:
          gender,

        date_of_birth:
          dateOfBirth,

        mobile:
          mobile,

        email:
          email,

        aadhaar_number:
          aadhaarNumber,

        qualification:
          qualification || null,

        address:
          address || null,

        state:
          state || null,

        district:
          district || null,

        pin_code:
          pinCode || null,

        photo_path:
          photoPath,

        document_path:
          documentPath,

        status:
          "pending"
      })
      .select()
      .single();

    if (studentError) {
      throw studentError;
    }

    studentId =
      student.id;

    /* ---------------------------------------------
       Create Enrollment
    --------------------------------------------- */

    showMessage(
      "Course enrollment create हो रहा है..."
    );

    const {
      data: enrollment,
      error: enrollmentError
    } = await sb
      .from("enrollments")
      .insert({
        student_id:
          student.id,

        course_id:
          courseId,

        fee_amount:
          fee,

        discount_amount:
          discount,

        payable_amount:
          payable,

        status:
          "pending_payment"
      })
      .select()
      .single();

    if (enrollmentError) {
      throw enrollmentError;
    }

    enrollmentId =
      enrollment.id;

    /* ---------------------------------------------
       Create Payment Row
    --------------------------------------------- */

    showMessage(
      "Payment record create हो रहा है..."
    );

    const paymentNotes =
      appliedCoupon
        ? `Coupon: ${appliedCoupon} (${appliedDiscountPercent}% discount)`
        : "No coupon used";

    const {
      error: paymentError
    } = await sb
      .from("payments")
      .insert({
        enrollment_id:
          enrollment.id,

        amount:
          payable,

        status:
          "pending",

        method:
          "razorpay",

        notes:
          paymentNotes
      });

    if (paymentError) {
      throw paymentError;
    }

    /* ---------------------------------------------
       Success
    --------------------------------------------- */

    showMessage(
      "Registration successful! Payment page खुल रही है...",
      "success"
    );

    /* ---------------------------------------------
       Save temporary payment information
       for payment page
    --------------------------------------------- */

    try {
      sessionStorage.setItem(
        "mcx_last_enrollment_id",
        enrollment.id
      );

      sessionStorage.setItem(
        "mcx_last_enrollment_no",
        enrollment.enrollment_no || ""
      );

      sessionStorage.setItem(
        "mcx_last_payable_amount",
        String(payable)
      );
    } catch (storageError) {
      console.warn(
        "Session storage unavailable:",
        storageError
      );
    }

    /* ---------------------------------------------
       Redirect to Payment Page
    --------------------------------------------- */

    setTimeout(() => {
      window.location.href =
        "payment.html?enrollment=" +
        encodeURIComponent(
          enrollment.id
        );
    }, 700);

  } catch (error) {
    console.error(
      "Registration submit error:",
      error
    );

    /* ---------------------------------------------
       Cleanup uploaded files if DB failed
    --------------------------------------------- */

    if (!studentId) {
      if (photoPath) {
        await deletePrivateFile(
          photoPath
        );
      }

      if (documentPath) {
        await deletePrivateFile(
          documentPath
        );
      }
    }

    showMessage(
      "Registration failed: " +
        (error.message || error),
      "error"
    );

  } finally {
    if (submitButton) {
      submitButton.disabled =
        false;

      submitButton.textContent =
        "Submit Registration";
    }
  }
}

/* ---------------------------------------------------------
   Logout
--------------------------------------------------------- */

async function logoutUser() {
  try {
    const {
      error
    } = await sb.auth.signOut();

    if (error) {
      throw error;
    }

    window.location.href =
      "login.html";

  } catch (error) {
    console.error(
      "Logout error:",
      error
    );

    alert(
      "Logout failed: " +
        (error.message || error)
    );
  }
}

/* ---------------------------------------------------------
   Event Listeners
--------------------------------------------------------- */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    /* ---------------------------------------------
       Course change
    --------------------------------------------- */

    const courseSelect =
      $("course_id");

    if (courseSelect) {
      courseSelect.addEventListener(
        "change",
        updateSelectedCourseFee
      );
    }

    /* ---------------------------------------------
       Apply Coupon
    --------------------------------------------- */

    const applyCouponBtn =
      $("applyCouponBtn");

    if (applyCouponBtn) {
      applyCouponBtn.addEventListener(
        "click",
        applyCoupon
      );
    }

    /* ---------------------------------------------
       Coupon Enter key
    --------------------------------------------- */

    const couponInput =
      $("coupon_code");

    if (couponInput) {
      couponInput.addEventListener(
        "keydown",
        (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            applyCoupon();
          }
        }
      );
    }

    /* ---------------------------------------------
       Student Form
    --------------------------------------------- */

    const form =
      $("studentForm");

    if (form) {
      form.addEventListener(
        "submit",
        submitRegistration
      );
    }

    /* ---------------------------------------------
       Logout buttons
    --------------------------------------------- */

    const logoutButtons =
      document.querySelectorAll(
        "[data-logout]"
      );

    logoutButtons.forEach(
      (button) => {
        button.addEventListener(
          "click",
          logoutUser
        );
      }
    );

    /* ---------------------------------------------
       Initial registration loading
    --------------------------------------------- */

    loadRegistration();
  }
);
