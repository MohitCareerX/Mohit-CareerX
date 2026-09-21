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

function showMsg(text, error = false) {
  if (!msg) return;

  msg.textContent = text;
  msg.className = error ? "notice error" : "notice";
}

/* =========================
   LOGIN SESSION CHECK
========================= */
async function getLoggedInUser() {
  const { data, error } = await sb.auth.getSession();

  if (error) throw error;

  if (data?.session?.user) {
    return data.session.user;
  }

  const { data: userData, error: userError } =
    await sb.auth.getUser();

  if (userError) throw userError;

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

  const { error } = await sb.storage
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
   LOAD REGISTRATION PAGE
========================= */
async function loadRegistration() {

  try {

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

    form.style.display = "block";

    if (emailInput) {
      emailInput.value = user.email || "";
    }

    /* =========================
       LOAD ACTIVE COURSES
    ========================= */

    const {
      data: courses,
      error
    } = await sb
      .from("courses")
      .select(
        "id,code,name,duration_months,fee_inr"
      )
      .eq("active", true)
      .order("name");

    if (error) throw error;

    courseSelect.innerHTML =
      '<option value="">Select a course</option>' +

      (courses || [])
        .map(course => {

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

    /* =========================
       SELECT COURSE FROM URL
    ========================= */

    const requestedCourse =
      new URLSearchParams(location.search)
        .get("course");

    if (requestedCourse) {

      const selected =
        (courses || []).find(course =>
          course.id === requestedCourse ||
          course.code === requestedCourse
        );

      if (selected) {
        courseSelect.value = selected.id;
      }
    }

  } catch (error) {

    console.error(error);

    notice.innerHTML =
      "Login check failed: " +
      (error?.message || "Unknown error") +
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
  async (event) => {

    event.preventDefault();

    showMsg("Submitting registration...");

    const submitBtn =
      $("submitBtn");

    if (submitBtn) {
      submitBtn.disabled = true;
    }

    let photoPath = null;
    let documentPath = null;
    let studentCreated = false;

    try {

      /* =========================
         LOGIN CHECK
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
          .replace(/\D/g, "");

      if (aadhaar.length !== 12) {
        throw new Error(
          "Aadhaar Number must contain 12 digits."
        );
      }

      const mobile =
        $("mobile").value.trim();

      if (mobile.length < 10) {
        throw new Error(
          "Please enter a valid mobile number."
        );
      }

      const pin =
        $("pin_code").value.trim();

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
            $("gender").value || null,

          date_of_birth:
            $("date_of_birth").value ||
            null,

          mobile: mobile,

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
         CREATE PAYMENT RECORD
      ========================= */

      const {
        error: paymentError
      } = await sb
        .from("payments")
        .insert({

          enrollment_id:
            enrollment.id,

          amount:
            Number(
              enrollment.payable_amount || 0
            ),

          status:
            "pending",

          method:
            "manual",

          notes:
            "Registration submitted. Payment pending admin confirmation."
        });

      if (paymentError) {
        throw paymentError;
      }

      /* =========================
         SUCCESS
      ========================= */

      showMsg(
        "Registration successful! " +
        "Student Code: " +
        (student.student_code || "Generated") +
        " | Enrollment No: " +
        (enrollment.enrollment_no || "Generated") +
        " | Payment: Pending"
      );

      form.reset();

      if (emailInput) {
        emailInput.value =
          user.email || "";
      }

      notice.textContent =
        "Registration submitted successfully.";

    } catch (error) {

      console.error(error);

      /* =========================
         CLEANUP UPLOADS
      ========================= */

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
