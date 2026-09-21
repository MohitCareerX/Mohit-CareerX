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
let appliedCoupon = null;
let appliedDiscountPercent = 0;
let currentCourseFee = 0;


/* =========================
   MESSAGE
========================= */

function showMsg(text, error = false) {

  if (!msg) return;

  msg.textContent = text;

  msg.className =
    error
      ? "notice error"
      : "notice";
}


/* =========================
   LOGIN USER
========================= */

async function getLoggedInUser() {

  const {
    data,
    error
  } = await sb.auth.getSession();

  if (error) throw error;

  if (data?.session?.user) {
    return data.session.user;
  }

  const {
    data: userData,
    error: userError
  } = await sb.auth.getUser();

  if (userError) throw userError;

  return userData?.user || null;
}


/* =========================
   PRIVATE FILE UPLOAD
========================= */

async function uploadPrivateFile(
  userId,
  file,
  kind
) {

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


  if (
    file.size >
    5 * 1024 * 1024
  ) {

    throw new Error(
      kind + " file must be 5 MB or smaller."
    );

  }


  const ext =
    (
      file.name
        .split(".")
        .pop() || "bin"
    )
      .toLowerCase()
      .replace(
        /[^a-z0-9]/g,
        ""
      );


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


  if (error) throw error;

  return path;
}


/* =========================
   UPDATE FEE
========================= */

function updateFeeSummary() {

  if (!feeSummary) return;

  const fee =
    Number(currentCourseFee || 0);

  const discount =
    Math.round(
      fee *
      appliedDiscountPercent /
      100
    );

  const payable =
    Math.max(
      0,
      fee - discount
    );


  originalFeeEl.textContent =
    "₹" +
    fee.toLocaleString("en-IN");


  discountAmountEl.textContent =
    "₹" +
    discount.toLocaleString("en-IN");


  payableAmountEl.textContent =
    "₹" +
    payable.toLocaleString("en-IN");


  feeSummary.style.display =
    "block";
}


/* =========================
   COURSE FEE CHANGE
========================= */

courseSelect.addEventListener(
  "change",
  () => {

    const courseId =
      courseSelect.value;

    const course =
      courses.find(
        c => c.id === courseId
      );


    currentCourseFee =
      Number(
        course?.fee_inr || 0
      );


    /* Coupon remains applied
       when course changes */

    updateFeeSummary();

  }
);


/* =========================
   APPLY COUPON
========================= */

applyCouponBtn.addEventListener(
  "click",
  async () => {

    const code =
      couponInput.value
        .trim()
        .toUpperCase();


    if (!code) {

      couponMsg.textContent =
        "Please enter a coupon code.";

      couponMsg.style.color =
        "#ff6b6b";

      return;
    }


    applyCouponBtn.disabled =
      true;

    applyCouponBtn.textContent =
      "Checking...";


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


      /*
        RPC normally returns the
        discount percentage.

        Example:
        MOHIT002 → 20
      */

      let discountPercent = 0;


      if (
        typeof data === "number"
      ) {

        discountPercent =
          Number(data);

      }

      else if (
        typeof data === "string"
      ) {

        discountPercent =
          Number(data);

      }

      else if (
        Array.isArray(data)
      ) {

        if (data.length > 0) {

          const row =
            data[0];

          discountPercent =
            Number(
              row.discount_percent ||
              row.discount ||
              Object.values(row)[0] ||
              0
            );

        }

      }

      else if (
        data &&
        typeof data === "object"
      ) {

        discountPercent =
          Number(
            data.discount_percent ||
            data.discount ||
            Object.values(data)[0] ||
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


        couponMsg.textContent =
          "❌ Invalid, expired or unavailable coupon code.";

        couponMsg.style.color =
          "#ff6b6b";

        return;
      }


      /* SUCCESS */

      appliedCoupon =
        code;

      appliedDiscountPercent =
        discountPercent;


      updateFeeSummary();


      couponMsg.textContent =
        `✅ Coupon ${code} applied successfully — ${discountPercent}% discount.`;

      couponMsg.style.color =
        "#4ade80";


    } catch (error) {

      console.error(
        "Coupon error:",
        error
      );


      appliedCoupon = null;
      appliedDiscountPercent = 0;


      couponMsg.textContent =
        "❌ Coupon could not be applied: " +
        (error?.message ||
          "Unknown error");


      couponMsg.style.color =
        "#ff6b6b";


    } finally {

      applyCouponBtn.disabled =
        false;

      applyCouponBtn.textContent =
        "Apply Coupon";

    }

  }
);


/* =========================
   LOAD REGISTRATION
========================= */

async function loadRegistration() {

  try {

    notice.textContent =
      "Checking login...";


    const user =
      await getLoggedInUser();


    if (!user) {

      notice.innerHTML =
        'Login/Signup is required before registration. ' +
        '<a href="login.html?next=student-registration.html">Login</a> ' +
        'or <a href="signup.html">Create Account</a>.';

      return;
    }


    notice.textContent =
      "Logged in as " +
      (user.email || "");


    form.style.display =
      "block";


    emailInput.value =
      user.email || "";


    /* =========================
       LOAD COURSES
    ========================= */

    const {
      data,
      error
    } = await sb
      .from("courses")
      .select(
        "id,code,name,duration_months,fee_inr"
      )
      .eq(
        "active",
        true
      )
      .order("name");


    if (error) {
      throw error;
    }


    courses =
      data || [];


    courseSelect.innerHTML =
      '<option value="">Select a course</option>' +

      courses
        .map(
          course => {

            const fee =
              Number(
                course.fee_inr || 0
              ).toLocaleString(
                "en-IN"
              );


            return `
              <option value="${course.id}">
                ${course.code} — ${course.name} — ₹${fee}
              </option>
            `;

          }
        )
        .join("");


    /* =========================
       URL COURSE
    ========================= */

    const requested =
      new URLSearchParams(
        location.search
      ).get("course");


    if (requested) {

      const match =
        courses.find(
          course =>
            course.id === requested ||
            course.code === requested
        );


      if (match) {

        courseSelect.value =
          match.id;


        currentCourseFee =
          Number(
            match.fee_inr || 0
          );


        updateFeeSummary();

      }

    }

  } catch (error) {

    console.error(error);


    notice.innerHTML =
      "Login check failed: " +
      (
        error?.message ||
        "Unknown error"
      ) +

      `
        <br><br>
        <button
          type="button"
          class="btn primary"
          onclick="location.reload()"
        >
          Refresh
        </button>
      `;


    showMsg(
      error?.message ||
      "Unable to check login session.",
      true
    );

  }

}


/* =========================
   FORM SUBMIT
========================= */

form.addEventListener(
  "submit",
  async event => {

    event.preventDefault();


    showMsg(
      "Submitting registration..."
    );


    const submitBtn =
      $("submitBtn");


    submitBtn.disabled =
      true;


    let photoPath = null;
    let documentPath = null;

    let studentCreated =
      false;


    try {

      /* =========================
         LOGIN
      ========================= */

      const user =
        await getLoggedInUser();


      if (!user) {

        throw new Error(
          "Please login first."
        );

      }


      /* =========================
         VALIDATION
      ========================= */

      const aadhaar =
        $("aadhaar_number")
          .value
          .replace(
            /\D/g,
            ""
          );


      if (
        aadhaar.length !== 12
      ) {

        throw new Error(
          "Aadhaar Number must contain 12 digits."
        );

      }


      const mobile =
        $("mobile")
          .value
          .trim();


      if (
        mobile.length < 10
      ) {

        throw new Error(
          "Please enter a valid mobile number."
        );

      }


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


      const courseId =
        courseSelect.value;


      if (!courseId) {

        throw new Error(
          "Please select a course."
        );

      }


      /* =========================
         FINAL COURSE FEE
      ========================= */

      const selectedCourse =
        courses.find(
          c =>
            c.id === courseId
        );


      if (!selectedCourse) {

        throw new Error(
          "Selected course could not be found."
        );

      }


      const courseFee =
        Number(
          selectedCourse.fee_inr || 0
        );


      const discount =
        Math.round(
          courseFee *
          appliedDiscountPercent /
          100
        );


      const payable =
        Math.max(
          0,
          courseFee - discount
        );


      /* =========================
         UPLOAD PHOTO
      ========================= */

      photoPath =
        await uploadPrivateFile(
          user.id,
          $("photo").files[0],
          "photo"
        );


      /* =========================
         UPLOAD DOCUMENT
      ========================= */

      documentPath =
        await uploadPrivateFile(
          user.id,
          $("document").files[0],
          "document"
        );


      /* =========================
         CREATE STUDENT
      ========================= */

      const {
        data: student,
        error: studentError
      } = await sb
        .from("students")
        .insert({

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
            $("gender")
              .value ||
            null,

          date_of_birth:
            $("date_of_birth")
              .value ||
            null,

          mobile:

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

        })

        .select(
          "id,student_code"
        )

        .single();


      if (studentError) {
        throw studentError;
      }


      studentCreated =
        true;


      /* =========================
         CREATE ENROLLMENT
      ========================= */

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


      /* =========================
         CREATE PAYMENT
      ========================= */

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
            appliedCoupon

              ? `Registration submitted. Coupon ${appliedCoupon} applied (${appliedDiscountPercent}%). Payment pending admin confirmation.`

              : "Registration submitted. Payment pending admin confirmation."

        });


      if (paymentError) {
        throw paymentError;
      }


      /* =========================
         SUCCESS
      ========================= */

      showMsg(

        `Registration successful! ` +

        `Student Code: ${
          student.student_code ||
          "Generated"
        } | ` +

        `Enrollment No: ${
          enrollment.enrollment_no ||
          "Generated"
        } | ` +

        `Course Fee: ₹${
          courseFee.toLocaleString("en-IN")
        } | ` +

        `Discount: ₹${
          discount.toLocaleString("en-IN")
        } | ` +

        `Payable: ₹${
          payable.toLocaleString("en-IN")
        } | ` +

        `Payment: Pending`

      );


      form.reset();


      emailInput.value =
        user.email ||
        "";


      appliedCoupon =
        null;


      appliedDiscountPercent =
        0;


      currentCourseFee =
        0;


      feeSummary.style.display =
        "none";


      couponMsg.textContent =
        "";


      notice.textContent =
        "Registration submitted successfully.";


    } catch (error) {

      console.error(
        "Registration error:",
        error
      );


      /* =========================
         CLEANUP FILES
      ========================= */

      if (
        !studentCreated &&
        photoPath
      ) {

        await sb.storage
          .from("student-private")
          .remove([
            photoPath
          ])
          .catch(
            () => {}
          );

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
          .catch(
            () => {}
          );

      }


      showMsg(

        error?.message ||
        "Registration failed. Please try again.",

        true

      );

    } finally {

      submitBtn.disabled =
        false;

    }

  }
);


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
