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

let courses = [];
let currentCourseFee = 0;
let appliedCoupon = null;
let appliedDiscountPercent = 0;

function showMsg(text, error = false) {
  if (!msg) return;

  msg.textContent = text;
  msg.className = error ? "notice error" : "notice";
}

function showCouponMsg(text, error = false) {
  if (!couponMsg) return;

  couponMsg.textContent = text;
  couponMsg.className = error ? "notice error" : "notice";
}

function formatINR(amount) {
  return "₹" + Number(amount || 0).toLocaleString("en-IN");
}

/* =========================
   LOGIN / SESSION
========================= */

async function getLoggedInUser() {
  const {
    data: sessionData,
    error: sessionError
  } = await sb.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (sessionData?.session?.user) {
    return sessionData.session.user;
  }

  const {
    data: userData,
    error: userError
  } = await sb.auth.getUser();

  if (userError) {
    throw userError;
  }

  return userData?.user || null;
}

/* =========================
   PRIVATE FILE UPLOAD
========================= */

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
      ? ["image/jpeg", "image/png", "image/webp"]
      : ["image/jpeg", "image/png", "application/pdf"];

  if (!allowed.includes(file.type)) {
    throw new Error(
      kind === "photo"
        ? "Photo must be JPG, PNG or WEBP."
        : "Document must be JPG, PNG or PDF."
    );
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error(kind + " file must be 5 MB or smaller.");
  }

  const ext = (file.name.split(".").pop() || "bin")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  const path = `${userId}/${kind}-${crypto.randomUUID()}.${ext}`;

  const { error } = await sb.storage
    .from("student-private")
    .upload(path, file, {
      upsert: false,
      contentType: file.type
    });

  if (error) {
    throw error;
  }

  return path;
}

/* =========================
   UPDATE FEE SUMMARY
========================= */

function updateFeeSummary() {
  const fee = Number(currentCourseFee || 0);

  const discount =
    appliedDiscountPercent > 0
      ? Math.round((fee * appliedDiscountPercent) / 100)
      : 0;

  const payable = Math.max(0, fee - discount);

  if (originalFeeEl) {
    originalFeeEl.textContent = formatINR(fee);
  }

  if (discountAmountEl) {
    discountAmountEl.textContent = formatINR(discount);
  }

  if (payableAmountEl) {
    payableAmountEl.textContent = formatINR(payable);
  }

  if (feeSummary) {
    feeSummary.style.display = "block";
  }

  return {
    fee,
    discount,
    payable
  };
}

/* =========================
   RESET COUPON
========================= */

function resetCoupon() {
  appliedCoupon = null;
  appliedDiscountPercent = 0;

  if (couponInput) {
    couponInput.value = "";
  }

  if (couponMsg) {
    couponMsg.textContent = "";
    couponMsg.className = "";
  }

  updateFeeSummary();
}

/* =========================
   COURSE CHANGE
========================= */

function updateSelectedCourseFee() {
  const courseId = courseSelect?.value;

  const course = courses.find(
    (c) => String(c.id) === String(courseId)
  );

  currentCourseFee = Number(course?.fee_inr || 0);

  /*
    Course change means previous coupon result should not
    silently remain attached to another course.
  */
  appliedCoupon = null;
  appliedDiscountPercent = 0;

  if (couponInput) {
    couponInput.value = "";
  }

  if (couponMsg) {
    couponMsg.textContent = "";
    couponMsg.className = "";
  }

  updateFeeSummary();
}

/* =========================
   APPLY COUPON
========================= */

async function applyCoupon() {
  if (!couponInput) {
    console.error("coupon_code input not found.");
    return;
  }

  const code = couponInput.value.trim().toUpperCase();

  if (!code) {
    showCouponMsg("Please enter a coupon code.", true);
    return;
  }

  if (!currentCourseFee && currentCourseFee !== 0) {
    showCouponMsg("Please select a course first.", true);
    return;
  }

  if (applyCouponBtn) {
    applyCouponBtn.disabled = true;
    applyCouponBtn.textContent = "Checking...";
  }

  showCouponMsg("Checking coupon...");

  try {
    const { data, error } = await sb.rpc(
      "get_coupon_discount",
      {
        p_code: code
      }
    );

    if (error) {
      console.error("Coupon RPC error:", error);
      throw error;
    }

    console.log("Coupon RPC response:", data);

    /*
      Supabase RPC can return different shapes depending
      on the PostgreSQL function return type.

      Supported:
      20
      "20"
      [{ discount_percent: 20 }]
      { discount_percent: 20 }
      { get_coupon_discount: 20 }
    */

    let discountPercent = 0;

    if (typeof data === "number") {
      discountPercent = Number(data);
    } else if (typeof data === "string") {
      discountPercent = Number(data);
    } else if (Array.isArray(data)) {
      if (data.length > 0) {
        const row = data[0];

        if (typeof row === "number") {
          discountPercent = Number(row);
        } else if (typeof row === "string") {
          discountPercent = Number(row);
        } else if (row && typeof row === "object") {
          discountPercent = Number(
            row.discount_percent ??
            row.get_coupon_discount ??
            row.discount ??
            Object.values(row)[0] ??
            0
          );
        }
      }
    } else if (data && typeof data === "object") {
      discountPercent = Number(
        data.discount_percent ??
        data.get_coupon_discount ??
        data.discount ??
        Object.values(data)[0] ??
        0
      );
    }

    if (!Number.isFinite(discountPercent)) {
      discountPercent = 0;
    }

    if (discountPercent <= 0) {
      appliedCoupon = null;
      appliedDiscountPercent = 0;
      updateFeeSummary();

      showCouponMsg(
        "Invalid, expired or inactive coupon code.",
        true
      );

      return;
    }

    if (discountPercent > 100) {
      throw new Error("Invalid discount percentage returned by server.");
    }

    appliedCoupon = code;
    appliedDiscountPercent = discountPercent;

    const summary = updateFeeSummary();

    showCouponMsg(
      `Coupon applied successfully! ${discountPercent}% discount. Payable amount: ${formatINR(summary.payable)}`
    );

  } catch (error) {
    console.error("Apply coupon failed:", error);

    appliedCoupon = null;
    appliedDiscountPercent = 0;

    updateFeeSummary();

    showCouponMsg(
      error?.message ||
        "Coupon apply nahi ho paya. Please try again.",
      true
    );

  } finally {
    if (applyCouponBtn) {
      applyCouponBtn.disabled = false;
      applyCouponBtn.textContent = "Apply Coupon";
    }
  }
}

/* =========================
   LOAD REGISTRATION PAGE
========================= */

async function loadRegistration() {
  try {
    if (!notice) {
      throw new Error("authNotice element not found.");
    }

    notice.textContent = "Checking login...";

    const user = await getLoggedInUser();

    if (!user) {
      notice.innerHTML =
        'Login/Signup is required before registration. ' +
        '<a href="login.html?next=student-registration.html">Login</a> ' +
        'or <a href="signup.html">Create Account</a>.';

      return;
    }

    notice.textContent =
      "Logged in as " + (user.email || "");

    if (form) {
      form.style.display = "block";
    }

    if (emailInput) {
      emailInput.value = user.email || "";
    }

    const {
      data,
      error
    } = await sb
      .from("courses")
      .select(
        "id,code,name,description,duration_months,fee_inr"
      )
      .eq("active", true)
      .order("name");

    if (error) {
      throw error;
    }

    courses = data || [];

    if (!courseSelect) {
      throw new Error("course_id field not found.");
    }

    courseSelect.innerHTML =
      '<option value="">Select a course</option>' +
      courses
        .map(
          (course) =>
            `<option value="${String(course.id).replace(/"/g, "&quot;")}">
              ${course.code} — ${course.name} — ${formatINR(course.fee_inr)}
            </option>`
        )
        .join("");

    const requestedCourse =
      new URLSearchParams(location.search).get("course");

    if (requestedCourse) {
      const match = courses.find(
        (course) =>
          String(course.id) === String(requestedCourse) ||
          String(course.code) === String(requestedCourse)
      );

      if (match) {
        courseSelect.value = match.id;
      }
    }

    updateSelectedCourseFee();

  } catch (error) {
    console.error("Registration page error:", error);

    if (notice) {
      notice.innerHTML =
        "Login check failed: " +
        (error?.message || "Unknown error") +
        '<br><br>' +
        '<button type="button" class="btn primary" onclick="location.reload()">' +
        "Refresh" +
        "</button>";
    }

    showMsg(
      error?.message ||
        "Unable to check login session.",
      true
    );
  }
}

/* =========================
   COUPON BUTTON
========================= */

if (applyCouponBtn) {
  applyCouponBtn.addEventListener(
    "click",
    applyCoupon
  );
}

/*
  Allow Enter key inside coupon input.
*/
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

/* =========================
   COURSE CHANGE EVENT
========================= */

if (courseSelect) {
  courseSelect.addEventListener(
    "change",
    updateSelectedCourseFee
  );
}

/* =========================
   FORM SUBMIT
========================= */

if (form) {
  form.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      showMsg("Submitting registration...");

      const submitBtn = $("submitBtn");

      if (submitBtn) {
        submitBtn.disabled = true;
      }

      let photoPath = null;
      let documentPath = null;
      let studentCreated = false;

      try {
        const user = await getLoggedInUser();

        if (!user) {
          throw new Error("Please login first.");
        }

        const aadhaar = $("aadhaar_number")
          .value
          .replace(/\D/g, "");

        if (aadhaar.length !== 12) {
          throw new Error(
            "Aadhaar Number must contain 12 digits."
          );
        }

        const mobile = $("mobile")
          .value
          .trim();

        if (mobile.length < 10) {
          throw new Error(
            "Please enter a valid mobile number."
          );
        }

        const pin = $("pin_code")
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

        const courseId =
          courseSelect.value;

        if (!courseId) {
          throw new Error(
            "Please select a course."
          );
        }

        /*
          Calculate final amount from currently
          selected course + applied coupon.
        */

        const fee = Number(
          currentCourseFee || 0
        );

        const discount =
          appliedDiscountPercent > 0
            ? Math.round(
                (fee *
                  appliedDiscountPercent) /
                  100
              )
            : 0;

        const payable = Math.max(
          0,
          fee - discount
        );

        /*
          Upload private files.
        */

        photoPath =
          await uploadPrivateFile(
            user.id,
            $("photo").files[0],
            "photo"
          );

        documentPath =
          await uploadPrivateFile(
            user.id,
            $("document").files[0],
            "document"
          );

        /*
          Create student.
        */

        const {
          data: student,
          error: studentError
        } = await sb
          .from("students")
          .insert({
            user_id: user.id,
            auth_user_id: user.id,
            student_code: "",

            full_name:
              $("full_name")
                .value
                .trim(),

            father_name:
              $("father_name")
                .value
                .trim() || null,

            mother_name:
              $("mother_name")
                .value
                .trim() || null,

            gender:
              $("gender").value ||
              null,

            date_of_birth:
              $("date_of_birth").value ||
              null,

            mobile,

            email:
              user.email || null,

            aadhaar_number:
              aadhaar,

            qualification:
              $("qualification")
                .value
                .trim() || null,

            address:
              $("address")
                .value
                .trim() || null,

            state:
              $("state")
                .value
                .trim() || null,

            district:
              $("district")
                .value
                .trim() || null,

            pin_code:
              pin || null,

            photo_path:
              photoPath,

            document_path:
              documentPath,

            status:
              "pending"
          })
          .select(
            "id,student_code"
          )
          .single();

        if (studentError) {
          throw studentError;
        }

        studentCreated = true;

        /*
          Create enrollment.

          We explicitly send:
          fee_amount
          discount_amount
          payable_amount
        */

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
          .select(
            "id,fee_amount,discount_amount,payable_amount,enrollment_no"
          )
          .single();

        if (enrollmentError) {
          throw enrollmentError;
        }

        /*
          Create payment record.
        */

        const paymentNotes =
          appliedCoupon
            ? `Registration submitted. Coupon: ${appliedCoupon} (${appliedDiscountPercent}% discount). Payment pending admin confirmation.`
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

        /*
          Success message.
        */

        showMsg(
          `Registration successful. ` +
          `Student Code: ${
            student.student_code ||
            "generated"
          }. ` +
          `Enrollment No: ${
            enrollment.enrollment_no ||
            "generated"
          }. ` +
          `Course Fee: ${formatINR(fee)}. ` +
          `Discount: ${formatINR(discount)}. ` +
          `Payable: ${formatINR(payable)}. ` +
          `Payment status: Pending.`
        );

        form.reset();

        if (emailInput) {
          emailInput.value =
            user.email || "";
        }

        appliedCoupon = null;
        appliedDiscountPercent = 0;
        currentCourseFee = 0;

        if (couponInput) {
          couponInput.value = "";
        }

        if (couponMsg) {
          couponMsg.textContent = "";
          couponMsg.className = "";
        }

        if (feeSummary) {
          feeSummary.style.display =
            "none";
        }

        if (notice) {
          notice.textContent =
            "Registration submitted successfully.";
        }

      } catch (error) {
        console.error(
          "Registration error:",
          error
        );

        /*
          Remove private uploads if student
          creation did not complete.
        */

        if (
          !studentCreated &&
          photoPath
        ) {
          await sb.storage
            .from("student-private")
            .remove([photoPath])
            .catch(() => {});
        }

        if (
          !studentCreated &&
          documentPath
        ) {
          await sb.storage
            .from("student-private")
            .remove([documentPath])
            .catch(() => {});
        }

        showMsg(
          error?.message ||
            "Registration failed. Please try again.",
          true
        );

      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
        }
      }
    }
  );
}

/* =========================
   LOGOUT
========================= */

if ($("logout")) {
  $("logout").onclick =
    async () => {
      await sb.auth.signOut();
      location.href =
        "index.html";
    };
}

/* =========================
   START
========================= */

loadRegistration();
