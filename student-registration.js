// ============================================================
// MOHIT CAREERX - Student Registration
// Fixed version for current Supabase database structure
// ============================================================

const { createClient } = supabase;

const sb = createClient(
  window.MOHIT_CONFIG.SUPABASE_URL,
  window.MOHIT_CONFIG.SUPABASE_PUBLISHABLE_KEY
);

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const $ = (id) => document.getElementById(id);

const form = $("studentForm");
const notice = $("authNotice");
const msg = $("msg");
const courseSelect = $("course_id");
const emailInput = $("email");

function showMsg(text, isError = false) {
  if (!msg) return;

  msg.textContent = text;
  msg.className = isError
    ? "notice error"
    : "notice";
}

// ------------------------------------------------------------
// Upload private student file
// ------------------------------------------------------------

async function uploadPrivateFile(userId, file, kind) {

  if (!file) {
    throw new Error(
      `Please select ${kind === "photo" ? "passport-size photo" : "document"} file.`
    );
  }

  const allowedTypes =
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

  if (!allowedTypes.includes(file.type)) {
    throw new Error(
      `${kind === "photo" ? "Photo" : "Document"} format is not supported.`
    );
  }

  // Maximum 5 MB
  if (file.size > 5 * 1024 * 1024) {
    throw new Error(
      `${kind === "photo" ? "Photo" : "Document"} must be 5 MB or smaller.`
    );
  }

  let ext =
    file.name
      .split(".")
      .pop()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");

  if (!ext) {
    ext = kind === "photo" ? "jpg" : "bin";
  }

  // IMPORTANT:
  // First folder must be user's auth UUID.
  const path =
    `${userId}/${kind}-${crypto.randomUUID()}.${ext}`;

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

// ------------------------------------------------------------
// Load logged-in user and courses
// ------------------------------------------------------------

async function loadRegistrationPage() {

  try {

    const {
      data: { user },
      error: userError
    } = await sb.auth.getUser();

    if (userError) {
      console.error(userError);
    }

    // Not logged in
    if (!user) {

      if (notice) {
        notice.innerHTML =
          `Login/Signup is required before registration. 
          <a href="login.html?next=student-registration.html">
          Login
          </a>
          or
          <a href="signup.html">
          Create Account
          </a>.`;
      }

      if (form) {
        form.style.display = "none";
      }

      return;
    }

    // Logged in
    if (notice) {
      notice.textContent =
        "Logged in as " + (user.email || "");
    }

    if (form) {
      form.style.display = "";
    }

    if (emailInput) {
      emailInput.value = user.email || "";
    }

    // --------------------------------------------------------
    // Load active courses
    // --------------------------------------------------------

    const {
      data: courses,
      error: courseError
    } = await sb
      .from("courses")
      .select(
        "id,code,name,description,duration_months,fee_inr"
      )
      .eq("active", true)
      .order("name");

    if (courseError) {

      console.error(courseError);

      showMsg(
        "Courses could not be loaded: " +
        courseError.message,
        true
      );

      return;
    }

    if (!courseSelect) {
      console.error(
        "course_id select element not found."
      );
      return;
    }

    courseSelect.innerHTML =
      `<option value="">Select a course</option>` +
      (courses || [])
        .map(course => {

          const id =
            String(course.id)
              .replace(/"/g, "&quot;");

          const fee =
            Number(course.fee_inr || 0)
              .toLocaleString("en-IN");

          return `
            <option value="${id}">
              ${course.code} — ${course.name} — ₹${fee}
            </option>
          `;
        })
        .join("");

    // --------------------------------------------------------
    // Select course from URL
    // --------------------------------------------------------

    const params =
      new URLSearchParams(
        window.location.search
      );

    const requestedCourse =
      params.get("course");

    if (requestedCourse) {

      const matchedCourse =
        (courses || []).find(course =>
          course.id === requestedCourse ||
          course.code === requestedCourse
        );

      if (matchedCourse) {
        courseSelect.value =
          matchedCourse.id;
      }
    }

  } catch (error) {

    console.error(error);

    showMsg(
      error.message ||
      "Unable to load registration page.",
      true
    );
  }
}

// ------------------------------------------------------------
// Registration submit
// ------------------------------------------------------------

if (form) {

  form.addEventListener(
    "submit",
    async function (event) {

      event.preventDefault();

      const submitButton =
        $("submitBtn");

      if (submitButton) {
        submitButton.disabled = true;
      }

      showMsg(
        "Submitting registration..."
      );

      let photoPath = null;
      let documentPath = null;

      try {

        // ----------------------------------------------------
        // Get logged-in user
        // ----------------------------------------------------

        const {
          data: { user },
          error: userError
        } = await sb.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          throw new Error(
            "Please login before submitting registration."
          );
        }

        // ----------------------------------------------------
        // Read fields
        // ----------------------------------------------------

        const fullName =
          $("full_name")?.value.trim();

        const fatherName =
          $("father_name")?.value.trim();

        const motherName =
          $("mother_name")?.value.trim();

        const gender =
          $("gender")?.value || null;

        const dob =
          $("date_of_birth")?.value || null;

        const mobile =
          $("mobile")?.value.trim();

        const aadhaar =
          $("aadhaar_number")
            ?.value
            .replace(/\D/g, "");

        const qualification =
          $("qualification")?.value.trim();

        const state =
          $("state")?.value.trim();

        const district =
          $("district")?.value.trim();

        const pin =
          $("pin_code")?.value.trim();

        const address =
          $("address")?.value.trim();

        const courseId =
          courseSelect?.value;

        // ----------------------------------------------------
        // Validation
        // ----------------------------------------------------

        if (!fullName) {
          throw new Error(
            "Please enter Student Name."
          );
        }

        if (!mobile) {
          throw new Error(
            "Please enter Mobile Number."
          );
        }

        if (mobile.length < 10) {
          throw new Error(
            "Please enter a valid Mobile Number."
          );
        }

        if (!aadhaar) {
          throw new Error(
            "Please enter Aadhaar Number."
          );
        }

        if (aadhaar.length !== 12) {
          throw new Error(
            "Aadhaar Number must contain 12 digits."
          );
        }

        if (pin && !/^\d{6}$/.test(pin)) {
          throw new Error(
            "PIN Code must contain 6 digits."
          );
        }

        if (!courseId) {
          throw new Error(
            "Please select a course."
          );
        }

        // ----------------------------------------------------
        // Files
        // ----------------------------------------------------

        const photoFile =
          $("photo")?.files?.[0];

        const documentFile =
          $("document")?.files?.[0];

        if (!photoFile) {
          throw new Error(
            "Please upload Passport-size Photo."
          );
        }

        if (!documentFile) {
          throw new Error(
            "Please upload Document."
          );
        }

        // ----------------------------------------------------
        // Upload PRIVATE photo
        // ----------------------------------------------------

        showMsg(
          "Uploading passport photo..."
        );

        photoPath =
          await uploadPrivateFile(
            user.id,
            photoFile,
            "photo"
          );

        // ----------------------------------------------------
        // Upload PRIVATE document
        // ----------------------------------------------------

        showMsg(
          "Uploading document..."
        );

        documentPath =
          await uploadPrivateFile(
            user.id,
            documentFile,
            "document"
          );

        // ----------------------------------------------------
        // Insert student
        // ----------------------------------------------------
        //
        // IMPORTANT FIX:
        //
        // RLS policy checks:
        //
        // user_id = auth.uid()
        //
        // Therefore user_id MUST be supplied.
        //
        // Aadhaar/photo/document are stored in students
        // according to the current database structure.
        //
        // ----------------------------------------------------

        showMsg(
          "Saving student details..."
        );

        const studentPayload = {

          // REQUIRED FOR RLS
          user_id: user.id,

          // Existing column
          auth_user_id: user.id,

          // Trigger will generate:
          // MCX-STU-YYYY-000001
          student_code: "",

          full_name: fullName,

          father_name:
            fatherName || null,

          mother_name:
            motherName || null,

          gender:
            gender || null,

          date_of_birth:
            dob || null,

          mobile:
            mobile,

          email:
            user.email || null,

          // Sensitive information
          aadhaar_number:
            aadhaar,

          qualification:
            qualification || null,

          address:
            address || null,

          state:
            state || null,

          district:
            district || null,

          pin_code:
            pin || null,

          // PRIVATE STORAGE PATHS
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

        // ----------------------------------------------------
        // Create enrollment
        // ----------------------------------------------------

        showMsg(
          "Creating course enrollment..."
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

            status:
              "pending_payment"
          })
          .select(
            `
              id,
              enrollment_no,
              fee_amount,
              discount_amount,
              payable_amount
            `
          )
          .single();

        if (enrollmentError) {
          throw enrollmentError;
        }

        // ----------------------------------------------------
        // Create payment record
        // ----------------------------------------------------
        //
        // Manual payment for now.
        //
        // Admin can later update:
        // pending -> paid
        //
        // ----------------------------------------------------

        showMsg(
          "Creating payment record..."
        );

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

        // ----------------------------------------------------
        // SUCCESS
        // ----------------------------------------------------

        showMsg(
          `Registration successful!

Student Code:
${student.student_code || "Generated"}

Enrollment No:
${enrollment.enrollment_no || "Generated"}

Course Fee:
₹${Number(
  enrollment.fee_amount || 0
).toLocaleString("en-IN")}

Discount:
₹${Number(
  enrollment.discount_amount || 0
).toLocaleString("en-IN")}

Payable Amount:
₹${Number(
  enrollment.payable_amount || 0
).toLocaleString("en-IN")}

Payment Status:
Pending`
        );

        // Reset form
        form.reset();

        // Keep email
        if (emailInput) {
          emailInput.value =
            user.email || "";
        }

        // Reload course list
        await loadRegistrationPage();

      } catch (error) {

        console.error(
          "Registration error:",
          error
        );

        // ----------------------------------------------------
        // Cleanup private files if student insert failed
        // ----------------------------------------------------

        if (error) {

          if (photoPath) {

            try {

              await sb
                .storage
                .from("student-private")
                .remove([
                  photoPath
                ]);

            } catch (cleanupError) {

              console.warn(
                "Photo cleanup failed:",
                cleanupError
              );

            }
          }

          if (documentPath) {

            try {

              await sb
                .storage
                .from("student-private")
                .remove([
                  documentPath
                ]);

            } catch (cleanupError) {

              console.warn(
                "Document cleanup failed:",
                cleanupError
              );

            }
          }
        }

        showMsg(
          error?.message ||
          "Registration failed. Please try again.",
          true
        );

      } finally {

        if (submitButton) {
          submitButton.disabled = false;
        }

      }
    }
  );

}

// ------------------------------------------------------------
// Logout
// ------------------------------------------------------------

const logoutButton =
  $("logout");

if (logoutButton) {

  logoutButton.onclick =
    async function () {

      await sb.auth.signOut();

      window.location.href =
        "index.html";
    };
}

// ------------------------------------------------------------
// Start
// ------------------------------------------------------------

loadRegistrationPage();
