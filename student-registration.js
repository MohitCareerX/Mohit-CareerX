const { createClient } = supabase;

const sb = createClient(
  window.MOHIT_CONFIG.SUPABASE_URL,
  window.MOHIT_CONFIG.SUPABASE_PUBLISHABLE_KEY
);

const $ = (id) => document.getElementById(id);

let courses = [];
let selectedCourse = null;
let appliedCoupon = null;
let discountPercent = 0;

/* -----------------------------
   Helpers
----------------------------- */

function showMessage(text, error = false) {
  const el = $("msg");
  if (!el) return;

  el.textContent = text;
  el.style.color = error ? "#ff6b6b" : "#7CFFB2";
}

function showNotice(text, error = false) {
  const el = $("authNotice");
  if (!el) return;

  el.innerHTML = text;
  el.style.color = error ? "#ff6b6b" : "";
}

function getCourseIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("course");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* -----------------------------
   Load Courses
----------------------------- */

async function loadCourses() {
  const select = $("course_id");

  if (!select) return;

  const { data, error } = await sb
    .from("courses")
    .select(
      "id,code,name,description,duration_months,fee_inr,active"
    )
    .eq("active", true)
    .order("name");

  if (error) {
    console.error("Course loading error:", error);
    showMessage(
      "Unable to load courses: " + error.message,
      true
    );
    return;
  }

  courses = data || [];

  select.innerHTML =
    '<option value="">Select Course</option>' +
    courses
      .map(
        (course) => `
          <option value="${escapeHtml(course.id)}">
            ${escapeHtml(course.name)}
            — ₹${Number(course.fee_inr || 0)}
          </option>
        `
      )
      .join("");

  const courseFromUrl = getCourseIdFromUrl();

  if (courseFromUrl) {
    select.value = courseFromUrl;
    updateFeeSummary();
  }
}

/* -----------------------------
   Course Change
----------------------------- */

function updateFeeSummary() {
  const courseId = $("course_id")?.value;

  selectedCourse =
    courses.find(
      (course) => course.id === courseId
    ) || null;

  if (!selectedCourse) {
    if ($("feeSummary")) {
      $("feeSummary").style.display = "none";
    }
    return;
  }

  const fee =
    Number(selectedCourse.fee_inr || 0);

  const discount =
    Math.round(
      (fee * discountPercent) / 100 * 100
    ) / 100;

  const payable =
    Math.max(
      0,
      Math.round(
        (fee - discount) * 100
      ) / 100
    );

  if ($("originalFee")) {
    $("originalFee").textContent =
      "₹" + fee;
  }

  if ($("discountAmount")) {
    $("discountAmount").textContent =
      "₹" + discount;
  }

  if ($("payableAmount")) {
    $("payableAmount").textContent =
      "₹" + payable;
  }

  if ($("feeSummary")) {
    $("feeSummary").style.display =
      "block";
  }
}

/* -----------------------------
   Coupon
----------------------------- */

async function applyCoupon() {

  const input = $("coupon_code");
  const button = $("applyCouponBtn");

  if (!input) return;

  const code =
    input.value.trim().toUpperCase();

  if (!code) {

    if ($("couponMsg")) {
      $("couponMsg").textContent =
        "Please enter coupon code.";

      $("couponMsg").style.color =
        "#ff6b6b";
    }

    return;
  }

  if (button) {
    button.disabled = true;
    button.textContent = "Checking...";
  }

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

    if (error) throw error;

    let percent = 0;

    if (typeof data === "number") {

      percent = Number(data);

    } else if (
      Array.isArray(data) &&
      data.length
    ) {

      percent =
        Number(
          data[0]?.discount_percent ??
          data[0] ??
          0
        );

    } else if (
      data &&
      typeof data === "object"
    ) {

      percent =
        Number(
          data.discount_percent ?? 0
        );
    }

    if (!percent) {

      appliedCoupon = null;
      discountPercent = 0;

      if ($("couponMsg")) {

        $("couponMsg").textContent =
          "Invalid or expired coupon code.";

        $("couponMsg").style.color =
          "#ff6b6b";
      }

      updateFeeSummary();

      return;
    }

    appliedCoupon = code;
    discountPercent = percent;

    if ($("couponMsg")) {

      $("couponMsg").textContent =
        `Coupon applied successfully — ${percent}% discount.`;

      $("couponMsg").style.color =
        "#7CFFB2";
    }

    updateFeeSummary();

  } catch (error) {

    console.error(
      "Coupon error:",
      error
    );

    if ($("couponMsg")) {

      $("couponMsg").textContent =
        "Coupon check failed: " +
        error.message;

      $("couponMsg").style.color =
        "#ff6b6b";
    }

  } finally {

    if (button) {

      button.disabled = false;
      button.textContent =
        "Apply Coupon";
    }
  }
}

/* -----------------------------
   Registration
----------------------------- */

async function submitRegistration(event) {

  event.preventDefault();

  const form = $("studentForm");

  if (!form) return;

  showMessage(
    "Submitting registration..."
  );

  const courseId =
    $("course_id")?.value;

  if (!courseId) {

    showMessage(
      "Please select a course.",
      true
    );

    return;
  }

  const payload = {

    full_name:
      $("full_name")?.value.trim() || "",

    father_name:
      $("father_name")?.value.trim() || "",

    mother_name:
      $("mother_name")?.value.trim() || "",

    gender:
      $("gender")?.value || "",

    date_of_birth:
      $("date_of_birth")?.value || "",

    mobile:
      $("mobile")?.value.trim() || "",

    email:
      $("email")?.value.trim() || "",

    aadhaar_number:
      $("aadhaar_number")?.value.trim() || "",

    qualification:
      $("qualification")?.value.trim() || "",

    state:
      $("state")?.value.trim() || "",

    district:
      $("district")?.value.trim() || "",

    pin_code:
      $("pin_code")?.value.trim() || "",

    address:
      $("address")?.value.trim() || "",

    course_id:
      courseId,

    coupon_code:
      appliedCoupon || ""
  };

  /* Validation */

  if (!payload.full_name) {

    showMessage(
      "Please enter full name.",
      true
    );

    return;
  }

  if (!payload.mobile) {

    showMessage(
      "Please enter mobile number.",
      true
    );

    return;
  }

  if (!payload.email) {

    showMessage(
      "Please enter email address.",
      true
    );

    return;
  }

  try {

    const functionUrl =
      window.MOHIT_CONFIG.SUPABASE_URL +
      "/functions/v1/public-student-registration";

    const response =
      await fetch(functionUrl, {

        method: "POST",

        headers: {
          "Content-Type": "application/json",

          apikey:
            window.MOHIT_CONFIG
              .SUPABASE_PUBLISHABLE_KEY
        },

        body:
          JSON.stringify(payload)
      });

    const result =
      await response.json();

    console.log(
      "Registration result:",
      result
    );

    if (
      !response.ok ||
      !result.success
    ) {

      throw new Error(
        result.error ||
        "Registration failed."
      );
    }

    /* --------------------------------
       IMPORTANT FIX:
       Edge Function returns TOP LEVEL
       fields.
    -------------------------------- */

    const studentCode =
      result.student_code || "";

    const enrollmentNo =
      result.enrollment_no || "";

    const courseName =
      result.course_name || "";

    const originalFee =
      Number(
        result.original_fee ?? 0
      );

    const discountAmount =
      Number(
        result.discount_amount ?? 0
      );

    const payable =
      Number(
        result.payable_amount ?? 0
      );

    const paymentStatus =
      result.payment_status ||
      "pending";

    const inviteSent =
      result.invite_sent === true;

    /* --------------------------------
       Success Message
    -------------------------------- */

    showMessage(
      "Registration successful!"
    );

    const successBox =
      document.createElement("div");

    successBox.style.marginTop =
      "20px";

    successBox.style.padding =
      "20px";

    successBox.style.borderRadius =
      "14px";

    successBox.style.background =
      "#071a3d";

    successBox.style.border =
      "1px solid rgba(255,255,255,.15)";

    successBox.innerHTML = `

      <h3 style="color:#7CFFB2;">
        ✅ Registration Successful
      </h3>

      <p style="margin-top:12px;">
        <strong>Student Code:</strong>
        ${escapeHtml(studentCode)}
      </p>

      <p>
        <strong>Enrollment No:</strong>
        ${escapeHtml(enrollmentNo)}
      </p>

      <p>
        <strong>Course:</strong>
        ${escapeHtml(courseName)}
      </p>

      <p>
        <strong>Course Fee:</strong>
        ₹${originalFee}
      </p>

      <p>
        <strong>Discount:</strong>
        ₹${discountAmount}
      </p>

      <p style="font-size:20px;">
        <strong>Payable Amount:</strong>
        ₹${payable}
      </p>

      <p style="margin-top:15px;color:#ffd21c;">
        Payment Status:
        ${escapeHtml(paymentStatus)}
      </p>

      ${
        inviteSent
          ? `
            <p style="
              margin-top:15px;
              color:#7CFFB2;
            ">
              📧 Account invitation sent to
              <strong>
                ${escapeHtml(payload.email)}
              </strong>.
              Please check your email to create your password.
            </p>
          `
          : `
            <p style="
              margin-top:15px;
              color:#ffd21c;
            ">
              🔐 An account already exists for this email.
              Please use your existing login.
            </p>
          `
      }

      <button
        type="button"
        class="btn primary"
        style="margin-top:12px;"
        onclick="window.location.href='index.html'"
      >
        Back to Home
      </button>
    `;

    form.parentElement.appendChild(
      successBox
    );

    /* Disable form */

    const buttons =
      form.querySelectorAll(
        "button, input[type=submit]"
      );

    buttons.forEach(
      (button) => {
        button.disabled = true;
      }
    );

  } catch (error) {

    console.error(
      "Registration error:",
      error
    );

    showMessage(
      error.message ||
      "Registration failed.",
      true
    );
  }
}

/* -----------------------------
   Registration Page
----------------------------- */

async function showRegistrationPage() {

  showNotice(
    "📝 You can register for a course without Login."
  );

  const form =
    $("studentForm");

  if (form) {
    form.style.display =
      "block";
  }

  await loadCourses();
}

/* -----------------------------
   Events
----------------------------- */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const courseSelect =
      $("course_id");

    if (courseSelect) {

      courseSelect.addEventListener(
        "change",
        updateFeeSummary
      );
    }

    const couponButton =
      $("applyCouponBtn");

    if (couponButton) {

      couponButton.addEventListener(
        "click",
        applyCoupon
      );
    }

    const form =
      $("studentForm");

    if (form) {

      form.addEventListener(
        "submit",
        submitRegistration
      );
    }

    showRegistrationPage();
  }
);
