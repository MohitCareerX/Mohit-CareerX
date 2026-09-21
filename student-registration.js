const { createClient } = supabase;

const sb = createClient(
  window.MOHIT_CONFIG.SUPABASE_URL,
  window.MOHIT_CONFIG.SUPABASE_PUBLISHABLE_KEY
);

const $ = (id) => document.getElementById(id);

const form = $("studentForm");
const notice = $("authNotice");
const msg = $("msg");
const courseSelect = $("course_id");
const emailInput = $("email");

const couponInput = $("coupon_code");
const applyCouponBtn = $("applyCouponBtn");
const couponMsg = $("couponMsg");

const feeSummary = $("feeSummary");
const originalFeeEl = $("originalFee");
const discountAmountEl = $("discountAmount");
const payableAmountEl = $("payableAmount");

let currentUser = null;
let courses = [];

let appliedCoupon = null;
let appliedDiscountPercent = 0;
let currentCourseFee = 0;


/* =========================================================
   MESSAGE
========================================================= */

function showMsg(text, error = false) {
  if (!msg) return;

  msg.textContent = text;
  msg.className = error
    ? "notice error"
    : "notice";
}


/* =========================================================
   LOGIN / SESSION
========================================================= */

async function getLoggedInUser() {
  try {
    const {
      data: sessionData,
      error: sessionError
    } = await sb.auth.getSession();

    if (sessionError) {
      console.error("Session error:", sessionError);
    }

    if (sessionData?.session?.user) {
      return sessionData.session.user;
    }

    const {
      data: userData,
      error: userError
    } = await sb.auth.getUser();

    if (userError) {
      console.error("User error:", userError);
      return null;
    }

    return userData?.user || null;

  } catch (error) {
    console.error("Login session check failed:", error);
    return null;
  }
}


/* =========================================================
   LOGIN URL
   Keeps selected course after login
========================================================= */

function getLoginUrl() {
  const currentPage =
    (location.pathname.split("/").pop() ||
      "student-registration.html") +
    location.search;

  return (
    "login.html?next=" +
    encodeURIComponent(currentPage)
  );
}


/* =========================================================
   PRIVATE FILE UPLOAD
========================================================= */

async function uploadPrivateFile(userId, file, kind) {

  if (!file) {
    throw new Error(
      kind === "photo"
        ? "Please select passport-size photo."
        : "Please select document."
    );
  }

  const allowed =
    kind === "photo"
      ? [
          "image/jpeg",
          "image/png",
          "image/webp"
        ]
      : [
          "image/jpeg",
          "image/png",
          "application/pdf"
        ];

  if (!allowed.includes(file.type)) {
    throw new Error(
      kind === "photo"
        ? "Photo must be JPG, PNG or WEBP."
        : "Document must be JPG, PNG or PDF."
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error(
      kind + " file must be 5 MB or smaller."
    );
  }

  const ext =
    (file.name.split(".").pop() || "bin")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  const path =
    `${userId}/${kind}-${crypto.randomUUID()}.${ext}`;

  const {
    error
  } = await sb.storage
    .from("student-private")
    .upload(
      path,
      file,
      {
        upsert: false,
        contentType: file.type
      }
    );

  if (error) {
    throw error;
  }

  return path;
}


/* =========================================================
   LOAD COURSES
========================================================= */

async function loadCourses() {

  const {
    data,
    error
  } = await sb
    .from("courses")
    .select(
      "id,code,name,duration_months,fee_inr"
    )
    .eq("active", true)
    .order("name");

  if (error) {
    throw error;
  }

  courses = data || [];

  courseSelect.innerHTML =
    '<option value="">Select a course</option>' +

    courses
      .map((course) => {

        const fee =
          Number(course.fee_inr || 0)
            .toLocaleString("en-IN");

        return `
          <option value="${course.id}">
            ${course.code} — ${course.name} — ₹${fee}
          </option>
        `;
      })
      .join("");

  /* Keep course selected from URL */
  const requestedCourse =
    new URLSearchParams(location.search)
      .get("course");

  if (requestedCourse) {

    const match =
      courses.find(
        (course) =>
          course.id === requestedCourse ||
          course.code === requestedCourse
      );

    if (match) {
      courseSelect.value = match.id;
    }
  }

  updateFeeSummary();
}


/* =========================================================
   GET SELECTED COURSE
========================================================= */

function getSelectedCourse() {

  const courseId =
    courseSelect.value;

  if (!courseId) {
    return null;
  }

  return courses.find(
    (course) =>
      course.id === courseId
  ) || null;
}


/* =========================================================
   FEE CALCULATION
========================================================= */

function updateFeeSummary() {

  const course =
    getSelectedCourse();

  if (!course) {

    currentCourseFee = 0;

    if (feeSummary) {
      feeSummary.style.display = "none";
    }

    return;
  }

  currentCourseFee =
    Number(course.fee_inr || 0);

  const discount =
    Math.round(
      currentCourseFee *
      appliedDiscountPercent /
      100
    );

  const payable =
    Math.max(
      currentCourseFee - discount,
      0
    );

  if (originalFeeEl) {
    originalFeeEl.textContent =
      "₹" +
      currentCourseFee.toLocaleString("en-IN");
  }

  if (discountAmountEl) {
    discountAmountEl.textContent =
      "₹" +
      discount.toLocaleString("en-IN");
  }

  if (payableAmountEl) {
    payableAmountEl.textContent =
      "₹" +
      payable.toLocaleString("en-IN");
  }

  if (feeSummary) {
    feeSummary.style.display = "block";
  }
}


/* =========================================================
   COUPON
========================================================= */

async function applyCoupon() {

  if (!couponInput) {
    return;
  }

  const code =
    couponInput.value
      .trim()
      .toUpperCase();

  if (!code) {

    if (couponMsg) {
      couponMsg.textContent =
        "Please enter coupon code.";

      couponMsg.className =
        "notice error";
    }

    return;
  }

  if (!getSelectedCourse()) {

    if (couponMsg) {
      couponMsg.textContent =
        "Please select a course first.";

      couponMsg.className =
        "notice error";
    }

    return;
  }

  if (applyCouponBtn) {
    applyCouponBtn.disabled = true;
    applyCouponBtn.textContent =
      "Checking...";
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

    if (error) {
      throw error;
    }

    let discountPercent = 0;

    /*
      Supabase RPC can return:
      number
      string
      array
      object
    */

    if (typeof data === "number") {

      discountPercent = data;

    } else if (typeof data === "string") {

      discountPercent =
        Number(data);

    } else if (Array.isArray(data)) {

      const first = data[0];

      if (typeof first === "number") {

        discountPercent = first;

      } else if (typeof first === "string") {

        discountPercent =
          Number(first);

      } else if (first) {

        discountPercent =
          Number(
            first.discount_percent ||
            first.get_coupon_discount ||
            0
          );
      }

    } else if (data && typeof data === "object") {

      discountPercent =
        Number(
          data.discount_percent ||
          data.get_coupon_discount ||
          0
        );
    }

    if (
      !discountPercent ||
      discountPercent <= 0
    ) {

      appliedCoupon = null;
      appliedDiscountPercent = 0;

      updateFeeSummary();

      if (couponMsg) {
        couponMsg.textContent =
          "Invalid, expired or inactive coupon code.";

        couponMsg.className =
          "notice error";
      }

      return;
    }

    appliedCoupon = code;
    appliedDiscountPercent =
      Math.min(
        Number(discountPercent),
        100
      );

    updateFeeSummary();

    if (couponMsg) {

      couponMsg.textContent =
        `Coupon applied successfully: ${appliedDiscountPercent}% discount.`;

      couponMsg.className =
        "notice";
    }

  } catch (error) {

    console.error(
      "Coupon error:",
      error
    );

    appliedCoupon = null;
    appliedDiscountPercent = 0;

    updateFeeSummary();

    if (couponMsg) {

      couponMsg.textContent =
        "Unable to apply coupon. Please try again.";

      couponMsg.className =
        "notice error";
    }

  } finally {

    if (applyCouponBtn) {

      applyCouponBtn.disabled =
        false;

      applyCouponBtn.textContent =
        "Apply Coupon";
    }
  }
}


/* =========================================================
   COURSE CHANGE
========================================================= */

if (courseSelect) {

  courseSelect.addEventListener(
    "change",
    () => {

      /*
        If course changes,
        remove old coupon because
        it may have been applied to
        another course.
      */

      appliedCoupon = null;
      appliedDiscountPercent = 0;

      if (couponInput) {
        couponInput.value = "";
      }

      if (couponMsg) {
        couponMsg.textContent = "";
      }

      updateFeeSummary();
    }
  );
}


/* =========================================================
   COUPON BUTTON
========================================================= */

if (applyCouponBtn) {

  applyCouponBtn.addEventListener(
    "click",
    applyCoupon
  );
}


/* =========================================================
   LOAD REGISTRATION PAGE
========================================================= */

async function loadRegistration() {

  try {

    notice.textContent =
      "Checking login...";

    const user =
      await getLoggedInUser();

    if (!user) {

      const loginUrl =
        getLoginUrl();

      notice.innerHTML =
        'Login/Signup is required before registration. ' +
        `<a href="${loginUrl}">Login</a> ` +
        'or <a href="signup.html">Create Account</a>.';

      form.style.display = "none";

      return;
    }

    currentUser = user;

    notice.textContent =
      "Logged in as " +
      (user.email || "");

    form.style.display =
      "block";

    emailInput.value =
      user.email || "";

    await loadCourses();

  } catch (error) {

    console.error(
      "Registration loading error:",
      error
    );

    notice.innerHTML =
      "Login check failed: " +
      (error?.message ||
        "Unknown error") +

      '<br><br>' +

      '<button type="button" class="btn primary" onclick="location.reload()">' +
      'Refresh' +
      '</button>';

    showMsg(
      error?.message ||
      "Unable to check login session.",
      true
    );
  }
}


/* =========================================================
   FORM SUBMIT
========================================================= */

if (form) {

  form.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();

      showMsg(
        "Submitting registration..."
      );

      const submitBtn =
        $("submitBtn");

      if (submitBtn) {
        submitBtn.disabled =
          true;
      }

      let photoPath = null;
      let documentPath = null;

      let studentCreated =
        false;

      try {

        /*
          Check session again
        */

        let user =
          currentUser ||
          await getLoggedInUser();

        if (!user) {

          throw new Error(
            "Login session नहीं मिली. Please login first."
          );
        }

        currentUser =
          user;

        /* Aadhaar */

        const aadhaar =
          $("aadhaar_number")
            .value
            .replace(/\D/g, "");

        if (aadhaar.length !== 12) {

          throw new Error(
            "Aadhaar Number must contain 12 digits."
          );
        }

        /* Mobile */

        const mobile =
          $("mobile")
            .value
            .trim();

        if (mobile.length < 10) {

          throw new Error(
            "Please enter a valid mobile number."
          );
        }

        /* PIN */

        const pin =
          $("pin_code")
            .value
            .trim();

        if (
          pin &&
          !/^\d{6}$/.test(pin)
        ) {

          throw new Error(
            "PIN Code must contain 6 digits."
          );
        }

        /* Course */

        const courseId =
          courseSelect.value;

        if (!courseId) {

          throw new Error(
            "Please select a course."
          );
        }

        const course =
          getSelectedCourse();

        if (!course) {

          throw new Error(
            "Selected course was not found."
          );
        }

        /* =================================================
           FINAL FEE
        ================================================= */

        const courseFee =
          Number(course.fee_inr || 0);

        const discount =
          Math.round(
            courseFee *
            appliedDiscountPercent /
            100
          );

        const payable =
          Math.max(
            courseFee - discount,
            0
          );

        /* =================================================
           UPLOAD PHOTO
        ================================================= */

        photoPath =
          await uploadPrivateFile(
            user.id,
            $("photo").files[0],
            "photo"
          );

        /* =================================================
           UPLOAD DOCUMENT
        ================================================= */

        documentPath =
          await uploadPrivateFile(
            user.id,
            $("document").files[0],
            "document"
          );

        /* =================================================
           CREATE STUDENT
        ================================================= */

        const studentPayload = {

          user_id:
            user.id,

          auth_user_id:
            user.id,

          student_code:
            "",

          full_name:
            $("full_name")
              .value
              .trim(),

          father_name:
            $("father_name")
              .value
              .trim() ||
            null,

          mother_name:
            $("mother_name")
              .value
              .trim() ||
            null,

          gender:
            $("gender").value ||
            null,

          date_of_birth:
            $("date_of_birth").value ||
            null,

          mobile,

          email:
            user.email ||
            null,

          aadhaar_number:
            aadhaar,

          qualification:
            $("qualification")
              .value
              .trim() ||
            null,

          address:
            $("address")
              .value
              .trim() ||
            null,

          state:
            $("state")
              .value
              .trim() ||
            null,

          district:
            $("district")
              .value
              .trim() ||
            null,

          pin_code:
            pin ||
            null,

          photo_path:
            photoPath,

          document_path:
            documentPath,

          status:
            "pending"
        };

        const {
          data: student,
          error: studentError
        } = await sb
          .from("students")
          .insert(studentPayload)
          .select(
            "id,student_code"
          )
          .single();

        if (studentError) {
          throw studentError;
        }

        studentCreated =
          true;

        /* =================================================
           CREATE ENROLLMENT
        ================================================= */

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
              courseFee,

            discount_amount:
              discount,

            payable_amount:
              payable,

            status:
              "pending_payment"
          })
          .select(
            "id,fee_amount,discount_amount,payable_amount,enrollment_no"
          )
          .single();

        if (enrollmentError) {
          throw enrollmentError;
        }

        /* =================================================
           CREATE PAYMENT RECORD
        ================================================= */

        const paymentNotes =
          appliedCoupon
            ? `Registration submitted. Coupon ${appliedCoupon} applied (${appliedDiscountPercent}% discount). Payment pending.`
            : "Registration submitted. Payment pending admin confirmation.";

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
              "manual",

            notes:
              paymentNotes
          });

        if (paymentError) {
          throw paymentError;
        }

        /* =================================================
           SUCCESS
        ================================================= */

        showMsg(
          `Registration successful. ` +
          `Student Code: ${student.student_code || "generated"}. ` +
          `Enrollment No: ${enrollment.enrollment_no || "generated"}. ` +
          `Course Fee: ₹${courseFee.toLocaleString("en-IN")}. ` +
          `Discount: ₹${discount.toLocaleString("en-IN")}. ` +
          `Payable: ₹${payable.toLocaleString("en-IN")}. ` +
          `Payment status: Pending.`
        );

        notice.textContent =
          "Registration submitted successfully.";

        /*
          Reset form
        */

        form.reset();

        emailInput.value =
          user.email || "";

        appliedCoupon =
          null;

        appliedDiscountPercent =
          0;

        currentCourseFee =
          0;

        if (couponMsg) {
          couponMsg.textContent =
            "";
        }

        if (feeSummary) {
          feeSummary.style.display =
            "none";
        }

      } catch (error) {

        console.error(
          "Registration error:",
          error
        );

        /*
          Delete uploaded private files
          if student creation failed.
        */

        if (
          !studentCreated &&
          photoPath
        ) {

          await sb.storage
            .from("student-private")
            .remove([
              photoPath
            ])
            .catch(() => {});
        }

        if (
          !studentCreated &&
          documentPath
        ) {

          await sb.storage
            .from("student-private")
            .remove([
              documentPath
            ])
            .catch(() => {});
        }

        showMsg(
          error?.message ||
          "Registration failed. Please try again.",
          true
        );

      } finally {

        if (submitBtn) {
          submitBtn.disabled =
            false;
        }
      }
    }
  );
}


/* =========================================================
   LOGOUT
========================================================= */

if ($("logout")) {

  $("logout").onclick =
    async () => {

      await sb.auth.signOut();

      currentUser =
        null;

      window.location.href =
        "index.html";
    };
}


/* =========================================================
   AUTH STATE LISTENER
========================================================= */

sb.auth.onAuthStateChange(
  (event, session) => {

    if (
      session?.user &&
      !currentUser
    ) {

      currentUser =
        session.user;

      /*
        Small delay prevents
        Supabase auth event race.
      */

      setTimeout(
        () => {
          loadRegistration();
        },
        100
      );
    }
  }
);


/* =========================================================
   START
========================================================= */

loadRegistration();
