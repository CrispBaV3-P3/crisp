console.log("BIVERSE.JS LOADED SUCCESSFULLY");
window.testFunction = function() {
    alert("JavaScript is working!");
};
// Add these JavaScript functions
function setRating(value) {
    document.getElementById('selectedRating').value = value;
    const stars = document.querySelectorAll('.star-rating .star');
    stars.forEach((star, index) => {
        if (index < value) {
            star.style.color = '#FFD700';
            star.style.textShadow = '0 0 10px rgba(255, 215, 0, 0.5)';
        } else {
            star.style.color = '#ddd';
            star.style.textShadow = 'none';
        }
    });
}

function showRatingModal() {
    document.getElementById('ratingModal').classList.add('active');
    setRating(0);
    document.getElementById('feedbackMsg').value = '';
}

function closeRatingModal() {
    document.getElementById('ratingModal').classList.remove('active');
}
async function submitRating() {
    const rating = document.getElementById('selectedRating').value;
    const feedback = document.getElementById('feedbackMsg').value.trim();
    
    if (rating == 0) {
        showToast("Please select a rating");
        return;
    }
    
    showToast("Sending feedback...");
    
    // Create visual stars (e.g., "★★★★☆" for 4 stars)
    const activeStars = "★".repeat(parseInt(rating));
    const inactiveStars = "☆".repeat(5 - parseInt(rating));
    const starsDisplay = activeStars + inactiveStars;
    
    try {
        // 1. SAVE TO GOOGLE SHEETS (Column K)
        const sheetResponse = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'submitRating',
                ratingStars: `${rating} Stars (${activeStars})`, // This saves "5 Stars (★★★★★)" in your sheet
                email: state.userEmail
            })
        });
        
        const sheetResult = await sheetResponse.json();
        console.log("[RATING] Sheet Save:", sheetResult);

        // 2. SEND EMAIL VIA EMAILJS (Using your NEW account & Feedback Template)
        const emailjsPayload = {
            service_id: "service_2ma1ygh",       // Your New Account Service ID
            template_id: "template_xwiw52c",     // Feedback Template ID from your screenshot
            user_id: "DBIAD6AqpQ2kwDqSn",        // Your New Account Public Key
            template_params: {
                // {{email}} goes to the "To Email *" field in your EmailJS template
                email: "cobelocrispin7@gmail.com",
                
                // Content variables matching your screenshot
                rating_number: rating,
                user_name: state.userName || "Seeker",
                user_email: state.userEmail || "No Email",
                rating_stars: starsDisplay,
                message: feedback || "No written feedback provided.",
                timestamp: new Date().toLocaleString()
            }
        };

        const emailResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(emailjsPayload)
        });

        if (!emailResponse.ok) {
            throw new Error("EmailJS failed to send");
        }
        
        showToast("Thank you for your feedback! ⭐");
        closeRatingModal();
        
    } catch (e) {
        console.error("Rating error:", e);
        showToast("Thanks for rating! ⭐");
        closeRatingModal();
    }
}
// ==================== GOOGLE SIGN-IN CONFIGURATION ====================
const GOOGLE_CLIENT_ID = "58464922508-8ch63q7f479i69cmq3i6nfcm8pj739nv.apps.googleusercontent.com";

let pendingGoogleUser = null;

// Initialize Google Identity Services
function initGoogleAuth() {
    if (typeof google === 'undefined') {
        console.log("[GOOGLE] Library not loaded yet...");
        setTimeout(initGoogleAuth, 500);
        return;
    }

    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredentialResponse,
        use_fedcm_for_prompt: true 
    });

    // Render Official Google Buttons (Works 100% on Mobile & Desktop)
    const loginContainer = document.getElementById('googleLoginContainer');
    if (loginContainer) {
        google.accounts.id.renderButton(loginContainer, { theme: "outline", size: "large", type: "icon", shape: "circle" });
    }

    const regContainer = document.getElementById('googleRegContainer');
    if (regContainer) {
        google.accounts.id.renderButton(regContainer, { theme: "outline", size: "large", type: "icon", shape: "circle" });
    }

    // Attempt to show the top-right dropdown prompt as a bonus
    google.accounts.id.prompt();
}

// Fix the missing modal bug by pointing to the correct ID
function showGoogleLicenseModal() {
    const modal = document.getElementById('licenseModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    }
}

function closeGoogleLicenseModal() {
    const modal = document.getElementById('licenseModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
    pendingGoogleUser = null;
}

function acceptLicense() {
    const modal = document.getElementById('licenseModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }

    if (pendingGoogleUser) {
        completeGoogleAuth(pendingGoogleUser);
        pendingGoogleUser = null;
    }
}

function completeGoogleAuth(userData) {
    state.pts = userData.points || 0;
    state.userEmail = userData.email;
    state.userName = userData.name;
    state.profilePic = userData.profile || userData.picture || "https://i.imgur.com/Bu2aW8n.png";
    state.isGoogleUser = true;

    document.getElementById('authOverlay').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'block';
    document.getElementById('resetBtn').style.display = 'block';

    save();
    showToast(`Welcome, ${userData.name}!`);

    updateUI();
    renderShop();
    loadRandom();
    syncStatus();
    setInterval(syncStatus, 600);
    initStatusTracking();
}

// Smart Unified Google Response Handler
async function handleGoogleCredentialResponse(response) {
    const credential = response.credential;
    const payload = jwt_decode(credential);

    const userData = {
        email: payload.email,
        name: payload.name,
        googleId: payload.sub,
        picture: payload.picture
    };

    showToast("Authenticating with Google...");

    try {
        // Step 1: Check if the user already exists (Try to Login)
        const loginResponse = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'googleAuth',
                email: userData.email,
                name: userData.name,
                googleId: userData.googleId,
                picture: userData.picture,
                deviceModel: getDeviceModel()
            })
        });

        const result = await loginResponse.json();

        if (result.success) {
            // SUCCESS: User exists! Log them in immediately.
            completeGoogleAuth({ ...userData, ...result.user });
            
        } else if (result.needSignup || result.message === "NOT_REGISTERED") {
            // NOT REGISTERED: Automatically create their account!
            showToast("Creating your account...");
            
            const regResponse = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'googleRegister',
                    email: userData.email,
                    name: userData.name,
                    googleId: userData.googleId,
                    picture: userData.picture,
                    deviceModel: getDeviceModel()
                })
            });

            const regResult = await regResponse.json();

            if (regResult.success) {
                // REGISTRATION SUCCESS: Show license agreement for new users
                pendingGoogleUser = { ...userData, ...regResult.user };
                showGoogleLicenseModal();
                showToast("✅ Account created! Please accept the agreement.");
            } else {
                showToast(regResult.message || "Registration failed");
            }
        } else if (result.message && result.message.includes("password")) {
            showToast("This email uses password login. Please use regular sign in.");
            setTimeout(() => showLogin(), 2000);
        } else {
            showToast(result.message || "Authentication failed");
        }

    } catch (e) {
        console.error("[GOOGLE AUTH] Error:", e);
        showToast("Network Error: Please try again.");
    }
}

// Initialize Google Auth when DOM loads
document.addEventListener('DOMContentLoaded', () => {
    initGoogleAuth();
});

const EMAILJS_OLD = {
    publicKey: "sNrp_awwUxXi4RU6O",
    service: "service_rc5eqhl",
    template: "template_ha5fvkh"
};

// NEW account - for forgot password
const EMAILJS_NEW = {
    publicKey: "DBIAD6AqpQ2kwDqSn",
    service: "service_2ma1ygh",  // ⚠️ VERIFY THIS IN EMAILJS DASHBOARD
    template: "template_imrtu7e"    // ⚠️ VERIFY THIS IN EMAILJS DASHBOARD
};

// Initialize OLD account by default
emailjs.init(EMAILJS_OLD.publicKey);

// ==================== EMAIL SEND FUNCTION (ONLY ONE DEFINITION) ====================
// Send using NEW account (forgot password) via REST API
async function testEmailJSConnection() {
    try {
        const testResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service_id: EMAILJS_NEW.service,
                template_id: EMAILJS_NEW.template,
                user_id: EMAILJS_NEW.publicKey,
                template_params: {
                    user_name: "Test User",
                    to_email: "test@example.com",
                    verification_code: "123456",
                    expiration_time: "Mar 29, 2026 at 7:30 PM"
                }
            })
        });
        
        console.log("Test Status:", testResponse.status);
        const text = await testResponse.text();
        console.log("Test Response:", text);
        return testResponse.ok;
        
    } catch (e) {
        console.error("Test Failed:", e);
        return false;
    }
}

// Initialize NEW account for forgot password
function initForgotPasswordEmailJS() {
    emailjs.init(EMAILJS_NEW.publicKey);
}
async function sendForgotPasswordEmail(params) {
    console.log("[EMAILJS] Sending to:", params.to_email);
    console.log("[EMAILJS] Code:", params.verification_code);
    
    try {
        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                service_id: EMAILJS_NEW.service,
                template_id: EMAILJS_NEW.template,
                user_id: EMAILJS_NEW.publicKey,
                template_params: {
                    user_name: params.user_name,
                    to_email: params.to_email,
                    verification_code: params.verification_code,
                    expiration_time: params.expiration_time
                }
            })
        });
        
        console.log("[EMAILJS] Response status:", response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error("[EMAILJS] Server error:", response.status, errorText);
            throw new Error(`EmailJS ${response.status}: ${errorText}`);
        }
        
        const result = await response.text();
        console.log("[EMAILJS] Success:", result);
        return result;
        
    } catch (error) {
        console.error("[EMAILJS] Send failed:", error);
        throw error;
    }
}

// ==================== TEST FUNCTION (OPTIONAL - for debugging) ====================
async function testEmailJSConnection() {
    console.log("Testing EmailJS with:", EMAILJS_NEW);
    try {
        const testResponse = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service_id: EMAILJS_NEW.service,
                template_id: EMAILJS_NEW.template,
                user_id: EMAILJS_NEW.publicKey,
                template_params: {
                    user_name: "Test User",
                    to_email: "test@example.com",
                    verification_code: "123456",
                    expiration_time: "Mar 29, 2026 at 7:30 PM"
                }
            })
        });
        
        console.log("Test Status:", testResponse.status);
        const text = await testResponse.text();
        console.log("Test Response:", text);
        return testResponse.ok;
        
    } catch (e) {
        console.error("Test Failed:", e);
        return false;
    }
}

// ==================== FORGOT PASSWORD SYSTEM ====================
let resetState = {
    email: '',
    verificationCode: '',
    canResend: true
};

function showForgotPassword() {
    hideAllAuthContainers();
    document.getElementById('forgotPasswordContainer').style.display = 'block';
    lucide.createIcons();
}

function showVerifyCode() {
    hideAllAuthContainers();
    document.getElementById('verifyCodeContainer').style.display = 'block';
    document.getElementById('verifyEmailDisplay').textContent = maskEmail(resetState.email);
    lucide.createIcons();
    setTimeout(() => document.getElementById('code1').focus(), 100);
}

function showResetPassword() {
    hideAllAuthContainers();
    document.getElementById('resetPasswordContainer').style.display = 'block';
    lucide.createIcons();
}

function showResetSuccess() {
    hideAllAuthContainers();
    document.getElementById('resetSuccessContainer').style.display = 'block';
    lucide.createIcons();
}
async function testEmailJS() {
    try {
        await sendForgotPasswordEmail({
            to_email: "your-test-email@gmail.com",
            user_name: "Test User",
            verification_code: "123456",
            expiration_time: "Mar 29, 2026 at 7:17 PM"
        });
        console.log("✅ Email sent successfully");
    } catch (e) {
        console.error("❌ Email failed:", e);
    }
}

function hideAllAuthContainers() {
    document.getElementById('loginContainer').style.display = 'none';
    document.getElementById('registerContainer').style.display = 'none';
    document.getElementById('forgotPasswordContainer').style.display = 'none';
    document.getElementById('verifyCodeContainer').style.display = 'none';
    document.getElementById('resetPasswordContainer').style.display = 'none';
    document.getElementById('resetSuccessContainer').style.display = 'none';
}

function maskEmail(email) {
    const [name, domain] = email.split('@');
    const masked = name.charAt(0) + '*'.repeat(name.length - 2) + name.charAt(name.length - 1);
    return masked + '@' + domain;
}

async function handleForgotPassword() {
    const email = document.getElementById('forgotEmail').value.trim();
    
    if (!email) {
        showToast("Please enter your email");
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast("Please enter a valid email address");
        return;
    }
    
    showToast("Generating verification code...");
    
    try {
        // Step 1: Generate code via Google Sheets
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'forgotPassword',
                email: email
            })
        });
        
        const result = await response.json();
        console.log("[APPS SCRIPT] Response:", result);
        
        if (!result.success || !result.verificationCode) {
            showToast(result.message || "Failed to generate code");
            return;
        }
        
        // Step 2: Prepare email data
        const now = new Date();
        const expiration = new Date(now.getTime() + 30 * 60000);
        const formattedTime = expiration.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        
        showToast("Sending email...");
        
        // Step 3: Send email via EmailJS
        try {
            await sendForgotPasswordEmail({
                to_email: email,
                user_name: result.name || "Seeker",
                verification_code: result.verificationCode,
                expiration_time: formattedTime
            });
            
            resetState.email = email;
            showToast("✅ Check your email for the code!");
            showVerifyCode();
            
        } catch (emailError) {
            console.error("[EMAIL ERROR]", emailError);
            showToast("⚠️ Code generated but email failed. Check console.");
            console.log("VERIFICATION CODE FOR TESTING:", result.verificationCode);
        }
        
    } catch (e) {
        console.error("[FORGOT PASSWORD] Error:", e);
        showToast("Error: " + e.message);
    }
}

function validateNumber(input) {
    input.value = input.value.replace(/[^0-9]/g, '');
}

function moveToNext(current, nextId) {
    if (current.value.length === 1) {
        document.getElementById(nextId).focus();
    }
}

function getEnteredCode() {
    let code = '';
    for (let i = 1; i <= 6; i++) {
        code += document.getElementById('code' + i).value;
    }
    return code;
}

function submitCode() {
    const code = getEnteredCode();
    if (code.length === 6) {
        verifyCode();
    }
}

async function verifyCode() {
    const enteredCode = getEnteredCode();
    
    if (enteredCode.length !== 6) {
        showToast("Please enter all 6 digits");
        return;
    }
    
    showToast("Verifying...");
    
    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'verifyCode',
                email: resetState.email,
                code: enteredCode
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast("✅ Code verified!");
            showResetPassword();
        } else {
            showToast(result.message || "Invalid or expired code");
            for (let i = 1; i <= 6; i++) {
                document.getElementById('code' + i).value = '';
            }
            document.getElementById('code1').focus();
        }
        
    } catch (e) {
        console.error("[VERIFY CODE] Error:", e);
        showToast("Error verifying code");
    }
}

async function resendCode() {
    if (!resetState.canResend) {
        showToast("Please wait before resending");
        return;
    }
    
    resetState.canResend = false;
    showToast("Resending code...");
    
    for (let i = 1; i <= 6; i++) {
        document.getElementById('code' + i).value = '';
    }
    
    await handleForgotPassword();
    
    setTimeout(() => {
        resetState.canResend = true;
    }, 30000);
}

function backToForgot() {
    document.getElementById('forgotEmail').value = resetState.email;
    showForgotPassword();
}

async function handlePasswordResetFinal() {
    const newPass = document.getElementById('newResetPass').value;
    const confirmPass = document.getElementById('confirmResetPass').value;
    
    if (!newPass || !confirmPass) {
        showToast("Please fill all fields");
        return;
    }
    
    if (newPass.length < 6) {
        showToast("Password must be at least 6 characters");
        return;
    }
    
    if (newPass !== confirmPass) {
        showToast("Passwords do not match");
        return;
    }
    
    showToast("Resetting password...");
    
    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'resetPassword',
                email: resetState.email,
                newPassword: newPass
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            resetState = { email: '', verificationCode: '', canResend: true };
            document.getElementById('forgotEmail').value = '';
            document.getElementById('newResetPass').value = '';
            document.getElementById('confirmResetPass').value = '';
            for (let i = 1; i <= 6; i++) {
                document.getElementById('code' + i).value = '';
            }
            
            showResetSuccess();
        } else {
            showToast(result.message || "Failed to reset password");
        }
        
    } catch (e) {
        console.error("[RESET PASSWORD] Error:", e);
        showToast("Error resetting password");
    }
}

function showLogin() {
    hideAllAuthContainers();
    document.getElementById('loginContainer').style.display = 'block';
    lucide.createIcons();
}

function showRegister() {
    hideAllAuthContainers();
    document.getElementById('registerContainer').style.display = 'block';
    lucide.createIcons();
}

function showLicenseModal() {
    console.log("[LICENSE] Opening modal");
    const modal = document.getElementById('licenseModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('active');
    } else {
        console.error("[LICENSE] Modal not found!");
    }
}

function closeLicenseModal() {
    console.log("[LICENSE] Closing modal");
    const modal = document.getElementById('licenseModal');
    const checkbox = document.getElementById('licenseAgreeLogin');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
    if (checkbox) {
        checkbox.checked = false;
    }
}

function acceptLicense() {
    console.log("[LICENSE] Accepted");
    const modal = document.getElementById('licenseModal');
    const checkbox = document.getElementById('licenseAgreeLogin');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
    if (checkbox) {
        checkbox.checked = true;
    }
}

// Hide scrollbars
(function() {
    const style = document.createElement('style');
    style.id = 'hide-scrollbar-style';
    style.innerHTML = `
        * {
            scrollbar-width: none !important;
            -ms-overflow-style: none !important;
        }
        *::-webkit-scrollbar {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
            background: transparent !important;
        }
    `;
    document.head.appendChild(style);
})();

document.addEventListener('touchmove', function(e) {
    if (e.touches.length > 1) {
        e.preventDefault();
    }
}, { passive: false });

let lastTouchEnd = 0;
document.addEventListener('touchend', function(e) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        e.preventDefault();
    }
    lastTouchEnd = now;
}, false);

function openResetModal() {
    document.getElementById('resetModal').classList.add('active');
}

function closeResetModal() {
    document.getElementById('resetModal').classList.remove('active');
    document.getElementById('currentPass').value = "";
    document.getElementById('newPass').value = "";
    document.getElementById('retypePass').value = "";
}

async function handlePasswordReset() {
    const currentPass = document.getElementById('currentPass').value;
    const newPass = document.getElementById('newPass').value;
    const retypePass = document.getElementById('retypePass').value;

    if (!currentPass || !newPass || !retypePass) return showToast("Please fill all fields");
    if (newPass !== retypePass) return showToast("New passwords do not match!");
    if (newPass.length < 6) return showToast("Password must be at least 6 characters");

    showToast("Updating security...");

    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'changePassword', 
                email: state.userEmail,
                oldPassword: currentPass,
                newPassword: newPass
            })
        });

        const result = await response.json();

        if (result.success) {
            showToast("✅ Password updated successfully!");
            closeResetModal();
        } else {
            showToast(result.message || "Failed to update password");
        }
    } catch (e) {
        console.error("Reset Error:", e);
        showToast("Server error. Check your connection.");
    }
}

function togglePassword(inputId, iconEl) {
    const input = document.getElementById(inputId);
    if (input.type === "password") {
        input.type = "text";
        iconEl.setAttribute('data-lucide', 'eye');
    } else {
        input.type = "password";
        iconEl.setAttribute('data-lucide', 'eye-off');
    }
    lucide.createIcons();
}
let statusInterval;

// Send online/offline status to Google Sheets
async function sendOnlineStatus(isOnline) {
    if (!state.userEmail) return;
    
    try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'updateOnlineStatus',
                email: state.userEmail,
                isOnline: isOnline
            }),
            // keepalive is crucial: it ensures the request completes even if the tab is closed!
            keepalive: true 
        });
        console.log(`[STATUS] Set to: ${isOnline ? 'Active' : 'Inactive'}`);
    } catch (e) {
        console.warn("[STATUS] Failed to sync status:", e);
    }
}

// Initialize the tracking loops & events
function initStatusTracking() {
    if (!state.userEmail) return;

    // Clear any existing intervals
    if (statusInterval) clearInterval(statusInterval);

    // 1. Immediately send 'Active' to Google Sheets
    sendOnlineStatus(true);

    // 2. Ping every 3 minutes to stay Active (prevents the server's 5-minute auto-inactive timeout)
    statusInterval = setInterval(() => {
        if (state.userEmail) {
            sendOnlineStatus(true);
        } else {
            clearInterval(statusInterval);
        }
    }, 180000); 

    // 3. Mark 'Inactive' when user closes the browser tab/window
    window.addEventListener('beforeunload', () => {
        if (state.userEmail) sendOnlineStatus(false);
    });

    // 4. Mark 'Inactive' when user minimizes the browser or switches tabs (Great for Mobile)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && state.userEmail) {
            sendOnlineStatus(false);
        } else if (document.visibilityState === 'visible' && state.userEmail) {
            sendOnlineStatus(true);
        }
    });
}
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby4668aGFmhQcewS4H0YM5TRQuYUyloGskoRBf0dsV5jqgGkCNEoHQJFiop0MpmPfEfKw/exec";

let state = JSON.parse(localStorage.getItem('bq_final_v18')) || { 
    pts: 0, 
    logs: [], 
    firstClaim: true, 
    userEmail: null,
    userName: null,
    profilePic: "https://i.imgur.com/Bu2aW8n.png",
    lastPointsUpdate: 0,
    claimLockUntil: 0
};
let allVerses = [];
let currentVerse = null;
let activeReward = null;
let currentChars = 0;
let tInt = null;

function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) {
        console.log("Toast:", msg);
        return;
    }
    toast.innerText = msg;
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

async function loadVersesFromSheet() {
    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'getVerses' })
        });
        
        const result = await response.json();
        
        if (result.success && result.verses && result.verses.length > 0) {
            allVerses = result.verses;
            console.log(`[VERSES] Loaded ${allVerses.length} verses from sheet`);
            return true;
        } else {
            console.warn("[VERSES] Failed to load from sheet, using fallback");
            allVerses = [
                { reference: "John 3:16", text: "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life." },
                { reference: "Psalm 23:1", text: "The Lord is my shepherd, I lack nothing." },
                { reference: "Proverbs 3:5", text: "Trust in the Lord with all your heart and lean not on your own understanding." },
                { reference: "Philippians 4:13", text: "I can do all this through him who gives me strength." },
                { reference: "Romans 8:28", text: "And we know that in all things God works for the good of those who love him, who have been called according to his purpose." }
            ];
            return false;
        }
    } catch (e) {
        console.error("[VERSES] Error loading:", e);
        allVerses = [{ reference: "John 3:16", text: "For God so loved the world..." }];
        return false;
    }
}

function getRandomVerse() {
    if (allVerses.length === 0) return null;
    return allVerses[Math.floor(Math.random() * allVerses.length)];
}

function toggleAuthMode() {
    const lBox = document.getElementById('loginBox');
    const rBox = document.getElementById('registerBox');
    lBox.style.display = lBox.style.display === 'none' ? 'block' : 'none';
    rBox.style.display = rBox.style.display === 'none' ? 'block' : 'none';
}

function getDeviceModel() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) {
    const match = ua.match(/Android[^;]*;\s*([^)]*)\)/);
    return match ? match[1].trim() : 'Android';
  }
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Mac/.test(ua)) return 'Mac';
  return 'Unknown';
}
async function handleAuth(mode) {
    console.log("[AUTH] Mode:", mode);
    
    try {
        const email = mode === 'login' ? document.getElementById('authEmail').value : document.getElementById('regEmail').value;
        const pass = mode === 'login' ? document.getElementById('authPass').value : document.getElementById('regPass').value;
        const name = mode === 'login' ? "" : document.getElementById('regName').value;

        if (!email || !pass) return showToast("Please fill all fields");
        
        // Get device info
        const deviceModel = getDeviceModel();
        console.log("[DEVICE] Detected:", deviceModel);
        
        showToast("Connecting...");
        
        if (mode === 'register') {
            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
                body: JSON.stringify({
                    action: 'register',
                    email: email,
                    password: pass,
                    name: name,
                    deviceModel: getDeviceModel()
                })
            });

            if (!response.ok) {
                return showToast(`Server error: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                document.getElementById('regName').value = '';
                document.getElementById('regEmail').value = '';
                document.getElementById('regPass').value = '';
                showToast("✅ Account created! Please login now.");
                setTimeout(() => showLogin(), 1000);
            } else {
                showToast(result.message || "Registration failed");
            }
        } else {
            const licenseChecked = document.getElementById('licenseAgreeLogin').checked;
            if (!licenseChecked) {
                showToast("Please agree to the User License Agreement");
                return;
            }

            const response = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'login', 
                    email: email,
                    password: pass,
		    deviceModel: getDeviceModel()
                })
            });
            
            if (!response.ok) {
                return showToast(`Server error: ${response.status}`);
            }

            const result = await response.json();

            if (result.success && result.user) {
                state.pts = result.user.points || 0;
                state.userEmail = result.user.email;
                state.userName = result.user.name;
                state.profilePic = result.user.profile || "https://i.imgur.com/Bu2aW8n.png";
                
                document.getElementById('authOverlay').style.display = 'none';
                document.getElementById('logoutBtn').style.display = 'block';
                document.getElementById('resetBtn').style.display = 'block';
                document.getElementById('authEmail').value = '';
                document.getElementById('authPass').value = '';
                
                save();
                showToast(`Welcome back, ${result.user.name}!`);
                
                updateUI();
                renderShop();
                loadRandom();
                syncStatus();
                setInterval(syncStatus, 100);
		initStatusTracking();
            } else {
                showToast(result.message || "Email or password incorrect");
            }
        }
    } catch (e) {
        console.error("[AUTH] Error:", e);
        showToast("Error: Check you internet connection!!");
    }
}
// ==================== REDEMPTION EMAIL FUNCTION ====================
// Notice we added 'templateId' as a parameter
async function sendRedemptionEmail(params, templateId) {
    console.log(`[EMAILJS] Sending template ${templateId} to:`, params.user_email);
    
    try {
        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                service_id: "service_rc5eqhl",
                template_id: templateId,              // Uses the specific template passed
                user_id: "sNrp_awwUxXi4RU6O",
                template_params: {
                    user_email: params.user_email,    // To Email
                    peso_value: params.peso_value,
                    method: params.method,            
                    mobile: params.mobile,            
                    extra_data: params.extra_data,    
                    subject: "via"                    
                }
            })
        });
        if (!response.ok) throw new Error("EmailJS Failed");
        return true;
    } catch (error) {
        console.error("[EMAILJS] Redemption email failed:", error);
        return false;
    }
}


// ==================== PROCESS REDEEM FUNCTION ====================
async function processRedeem() {
    const gName = document.getElementById('gName').value.trim();
    const gNum = document.getElementById('gNum').value.trim();
    const gEmail = document.getElementById('gEmail').value.trim();

    if (!gName) return showToast('Please enter GCash name');
    if (!gNum) return showToast('Please enter GCash number');
    if (!gEmail) return showToast('Please enter email for receipt');
    if (!activeReward) return showToast('No reward selected');
    
    if (!gNum.match(/^09\d{9}$/) && !gNum.match(/^\+639\d{9}$/)) {
        return showToast('Invalid GCash number format');
    }

    showToast("Processing redemption...");

    try {
        // 1. Process in Google Sheets FIRST
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'processRedemption',
                email: state.userEmail,
                userName: state.userName,
                redeemAmount: activeReward.val,
                cost: activeReward.cost,
                gcashNumber: gNum,
                gcashName: gName,
                receiptEmail: gEmail
            })
        });

        const result = await response.json();

        if (result.success) {
            state.pts = result.newPoints;
            state.amounts = result.newAmounts;
            if(activeReward.val === 1) state.firstClaim = false;
            
            save(); 
            renderShop(); 
            closeModal();
            showToast("✅ Redemption submitted!");
            
            // 2. SEND THE EMAILS
            try {
                const emailParams = {
                    method: "GCASH",
                    mobile: gNum,
                    extra_data: gName,
                    peso_value: "₱" + activeReward.val,
                    user_name: state.userName || "Unknown",
                    user_email_account: state.userEmail
                };

                // Email to USER (Auto-Reply Template)
                await sendRedemptionEmail({
                    ...emailParams,
                    user_email: gEmail 
                }, "template_o1r7hml"); 

                // Email to ADMIN COPY (Welcome/Admin Template)
                await sendRedemptionEmail({
                    ...emailParams,
                    user_email: "cobelocrispin7@gmail.com" 
                }, "template_ha5fvkh"); 

            } catch (emailErr) {
                console.log("[REDEEM] Email notification error:", emailErr);
            }
            
            // Sync status immediately to fetch new history, then show rating modal
            await syncStatus();
            setTimeout(() => { showRatingModal(); }, 1500);
            
        } else {
            showToast("Error: " + result.message);
        }
    } catch (e) {
        showToast("Error processing redemption: " + e.message);
    }
}
async function syncStatus() {
    if (!state.userEmail) {
        console.log("[SYNC] Not logged in, skipping");
        return;
    }
    
    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'getUserData',
                email: state.userEmail
            })
        });
        
        const result = await response.json();
        
        if (result.success && result.user) {
            const serverPoints = parseInt(result.user.points) || 0;
            const serverAmounts = parseFloat(result.user.amounts) || 0;
            
            // Only update from server if server has MORE points (admin added)
            // OR if local is 0 (first load)
            if (serverPoints > state.pts || state.pts === 0) {
                console.log(`[SYNC] Updating from server: ${state.pts} -> ${serverPoints}`);
                state.pts = serverPoints;
                state.amounts = serverAmounts;
                state.status = result.user.status;
                state.gcashNumber = result.user.gcashNumber;
                
                // Save and update display
                localStorage.setItem('bq_final_v18', JSON.stringify(state));
                document.getElementById('pts').innerText = state.pts.toLocaleString();
            }
            // If serverPoints <= state.pts, keep local (user just claimed or same)
            
            if (result.redemptionHistory) {
                updateRedemptionHistoryFromServer(result.redemptionHistory);
            }
            
            const logsSection = document.getElementById('logs');
            if (logsSection && logsSection.classList.contains('active')) {
                renderLogs();
            }
        }
    } catch (e) {
        console.warn("[SYNC] Failed to sync:", e.message);
    }
}
function updateRedemptionHistoryFromServer(serverHistory) {
    const nonRedemptionLogs = state.logs.filter(log => !log.includes("Redeemed"));
    state.logs = [...serverHistory, ...nonRedemptionLogs];
    console.log(`[SYNC] Updated ${serverHistory.length} redemptions from server`);
}

function save() { 
    localStorage.setItem('bq_final_v18', JSON.stringify(state)); 
    updateUI();  
}
async function syncPointsToCloud() {
    if (!state.userEmail || state.userEmail === 'guest') {
        console.log("[SYNC] Skipping sync: not logged in or guest user");
        return;
    }

    try {
        console.log("[SYNC] Pushing points to server:", state.pts);
        
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, 
            body: JSON.stringify({
                action: 'updatePoints',
                email: state.userEmail,
                points: state.pts
            })
        });
        
        if (!response.ok) {
            console.warn("[SYNC] Network error:", response.status);
            return;
        }

        const result = await response.json();
        if (result.success) {
            console.log("[SYNC] ✅ Server confirmed:", result.newPoints);
            // Extend lock slightly to ensure next syncStatus gets fresh data
            state.claimLockUntil = Date.now() + 100;
        } else {
            console.warn("[SYNC] Server error:", result.message);
        }
    } catch (e) {
        console.warn("[SYNC] Sync failed:", e.message);
    }
}
async function loadVerse(ref) {
    const vRefElem = document.getElementById('vRef');
    const vTextElem = document.getElementById('vText');
    const btn = document.getElementById('claimBtn');
    
    vTextElem.innerText = "Consulting the scriptures...";
    btn.disabled = true;

    try {
        const response = await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'searchVerses',
                query: ref
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            vRefElem.innerText = result.verse.reference;
            vTextElem.innerText = `"${result.verse.text}"`;
            currentVerse = result.verse;
            currentChars = result.verse.text.split(/\s+/).filter(word => word.length > 0).length;
            
            const seed = result.verse.reference.replace(/[^a-zA-Z0-9]/g, '');
            document.getElementById('verseImg').src = `https://picsum.photos/seed/${seed}/600/400`;
            
            startTimer();
            return;
        }
    } catch (e) {
        console.log("[VERSE] Server search failed, trying local:", e);
    }
    
    const foundVerse = allVerses.find(v => 
        v.reference.toLowerCase() === ref.toLowerCase()
    );

    if (foundVerse) {
        vRefElem.innerText = foundVerse.reference;
        vTextElem.innerText = `"${foundVerse.text}"`;
        currentVerse = foundVerse;
        currentChars = foundVerse.text.split(/\s+/).filter(word => word.length > 0).length;
        
        document.getElementById('verseImg').src = `https://picsum.photos/seed/${foundVerse.reference.replace(/\s/g, '')}/600/400`;
        startTimer();
    } else {
        try {
            const publicRes = await fetch(`https://bible-api.com/${encodeURIComponent(ref)}`);
            const publicData = await publicRes.json();
            
            if (publicData.text) {
                vRefElem.innerText = publicData.reference;
                vTextElem.innerText = `"${publicData.text.trim()}"`;
                currentChars = publicData.text.trim().split(/\s+/).filter(word => word.length > 0).length;
                currentVerse = { reference: publicData.reference, text: publicData.text.trim() };
                
                document.getElementById('verseImg').src = `https://picsum.photos/seed/${Math.random()}/600/400`;
                startTimer();
            } else {
                showToast("Verse not found.");
                loadRandom();
            }
        } catch (error) {
            showToast("Verse not found. Loading random...");
            loadRandom();
        }
    }
}

function loadRandom() {
    const verse = getRandomVerse();
    if (verse) {
        document.getElementById('vRef').innerText = verse.reference;
        document.getElementById('vText').innerText = `"${verse.text}"`;
        currentVerse = verse;
        currentChars = verse.text.split(/\s+/).filter(word => word.length > 0).length;
        
        document.getElementById('verseImg').src = `https://picsum.photos/seed/${verse.reference.replace(/\s/g, '')}/600/400`;
        startTimer();
    } else {
        document.getElementById('vRef').innerText = "John 3:16";
        document.getElementById('vText').innerText = "For God so loved the world...";
        currentChars = 10;
        startTimer();
    }
}

function startTimer() {
    let tLeft = 60;
    const circle = document.getElementById('pCircle');
    const btn = document.getElementById('claimBtn');
    const txt = document.getElementById('timerTxt');
    
    btn.disabled = true; 
    btn.innerText = "Meditating...";
    
    if(tInt) clearInterval(tInt);
    
    tInt = setInterval(() => {
        tLeft--; 
        txt.innerText = tLeft + "s";
        circle.style.strokeDashoffset = 283 - ((60 - tLeft) / 60 * 283);
        
        if(tLeft <= 0) { 
            clearInterval(tInt);
            txt.innerText = "AMEN";
            btn.disabled = false;
            btn.innerText = `Claim +${currentChars} Pts`;
        }
    }, 1000);
}

function claimAndNext() {
    if (!currentVerse) return;
    
    // Add points locally first
    state.pts += currentChars;
    
    // Update display immediately
    document.getElementById('pts').innerText = state.pts.toLocaleString();
    
    // Add to logs
    state.logs.unshift(`${new Date().toLocaleTimeString()}: ${currentVerse.reference} +${currentChars} words`);
    
    // Save to localStorage
    localStorage.setItem('bq_final_v18', JSON.stringify(state));
    
    // Sync to server in background
    syncPointsToCloud();
    
    document.getElementById('claimBtn').innerText = "Claimed!";
    setTimeout(loadRandom, 1000);
}
function renderShop() {
    const rewards = [{v:1, c:500}, {v:50, c:25000}, {v:100, c:50000}, {v:500, c:250000}];
    document.getElementById('shopList').innerHTML = rewards.map(i => {
        const isFree = (i.v === 1 && state.firstClaim);
        const cost = isFree ? 0 : i.c;
        return `
        <div class="shop-card">
            ${isFree ? '<span class="free-badge">NEWBIE GIFT</span>' : ''}
            <b>
                <img src="bg-gcash-icn.png" width="32" height="32" style="transform: translate(1px, 4px); margin-right: 10px;">
                <span style="display: inline-block; transform: translate(0px, -6px);font-size: 0.8rem;">₱${i.v} GCash</span>
            </b>
            <button onclick="openModal(${i.v}, ${cost})" style="background:var(--gold-gradient); border:none; padding:10px 15px; border-radius:10px; font-weight:900; cursor:pointer; color:#3a2a00;">
                ${isFree ? 'FREE' : cost.toLocaleString() + ' PTS'}
            </button>
        </div>`;
    }).join('');
}

function openModal(val, cost) {
    if(state.pts < cost) return showToast("Not enough points!");
    activeReward = { val, cost };
    document.getElementById('redeemModal').classList.add('active');
}

function closeModal() { 
    document.getElementById('redeemModal').classList.remove('active'); 
}

function showTab(id, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    el.classList.add('active');
    
    if(id === 'logs') {
        syncStatus();
        renderLogs();
    }
}

function renderLogs() {
    const logContent = document.getElementById('logContent');
    if (!logContent) return;
    
    if (state.logs.length === 0) {
        logContent.innerHTML = '<div style="text-align:center; color:#666; padding:20px;">No history yet. Start meditating!</div>';
        return;
    }
    
    const redemptionLogs = state.logs.filter(log => log.includes("Redeemed"));
    const meditationLogs = state.logs.filter(log => !log.includes("Redeemed") && log.includes("words"));
    
    let html = '';
    
    if (redemptionLogs.length > 0) {
        html += `<div style="margin-bottom:20px;"><h4 style="color:var(--gold); font-size:0.9rem; margin-bottom:10px; font-family:'Cinzel'; display: flex; align-items: center; gap: 8px;">
  <img src="gift-box.png" alt="Gift icon" style="height: 1.2rem;transform: scale(1.3); width: auto;">Redemptions History
</h4>`;
        html += redemptionLogs.map(log => formatLogEntry(log, 'redemption')).join('');
        html += `</div>`;
    }
    
    if (meditationLogs.length > 0) {
        html += `<div><h4 style="color:var(--gold); font-size:0.9rem; margin-bottom:10px; font-family:'Cinzel'; display: flex; align-items: center; gap: 8px;">
  <img src="meditation.png" alt="Gift icon" style="height: 1.2rem;transform:scale(1.6); width: auto;">Meditation History
</h4>`;
        html += meditationLogs.slice(0, 20).map(log => formatLogEntry(log, 'meditation')).join('');
        html += `</div>`;
    }
    
    logContent.innerHTML = html;
}

function formatLogEntry(log, type) {
    let styledLog = log;
    
    if (type === 'redemption') {
        if (log.includes("✅ Success")) {
            styledLog = log.replace('✅ Success', '<span style="color:#4CAF50; font-weight:800;">✅ Success</span>');
        } else if (log.includes("⏳ Pending...") || log.includes("Pending...")) {
            styledLog = log.replace(/[⏳\s]*Pending\.\.\./, '<span style="color:#ffa500; font-weight:800;">⏳ Pending...</span>');
        }
        
        styledLog = styledLog.replace(/(₱\d+)/, '<span style="color:var(--gold); font-weight:bold;">$1</span>');
        
        return `<div class="history-item" style="border-left: 3px solid ${log.includes('Success') ? '#4CAF50' : '#ffa500'}; background:rgba(255,215,0,0.05);">${styledLog}</div>`;
    } else {
        styledLog = log.replace(/(\+\d+ words)/, '<span style="color:#4CAF50; font-weight:bold;">$1</span>');
        return `<div class="history-item" style="border-left: 3px solid #4CAF50;">${styledLog}</div>`;
    }
}
// ==================== REDEMPTION EMAIL FUNCTION ====================


function manualSearch() { 
    const input = document.getElementById('vSearch');
    let q = input.value.trim();
    
    if(!q) return;
    
    if(q.toLowerCase() === "help") {
        window.open("https://crispba.github.io/crispinjr-official-websites/Help%20-%20Suggest%20-%20Error.html", "_blank");
        input.value = "";
        return; 
    }
    if(q.toLowerCase() === "admin dashboard") {
        window.open("https://crispba.github.io/crispinjr-official-websites/admin.html", "_blank");
        input.value = "";
        return; 
    }    
    q = q.replace(/\b\w/g, l => l.toUpperCase());
    
    loadVerse(q); 
    input.value = ""; 
    input.blur();
}

function updateUI() {
    const ptsElement = document.getElementById('pts');
    if (ptsElement) {
        ptsElement.innerText = state.pts.toLocaleString();
    }
}
async function logout() {
    // Tell the server the user is offline before logging out
    if (state.userEmail) {
        await sendOnlineStatus(false);
    }
    
    if (statusInterval) clearInterval(statusInterval);
    
    state.userEmail = null;
    state.userName = null;
    save();
    
    document.getElementById('logoutBtn').style.display = 'none';
    document.getElementById('resetBtn').style.display = 'none';
    document.getElementById('authOverlay').style.display = 'flex';
    location.reload(); 
}
async function init() { 
    await loadVersesFromSheet();
    
    if (!state.userEmail) {
        document.getElementById('authOverlay').style.display = 'flex';
        return;
    }
    
       // First sync to get server state
    await syncStatus();
    
    renderShop(); 
    loadRandom(); 
    
    // Fast sync for live updates (every 3 seconds)
    setInterval(syncStatus, 3000);
    
    // Sync when tab becomes visible
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            syncStatus();
        }
    });
    
    initStatusTracking();
    
    // Also sync immediately when user returns to tab
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            console.log('[SYNC] Tab visible, syncing...');
            syncStatus();
        }
    });
    
    document.getElementById('logoutBtn').style.display = 'block';
    document.getElementById('resetBtn').style.display = 'block';
}
document.addEventListener('DOMContentLoaded', () => {
    console.log("[INIT] Page loaded, initializing Bible Quest...");
    
    // Initialize OLD EmailJS account
    emailjs.init(EMAILJS_OLD.publicKey);
    lucide.createIcons();
    
    init();
    
    console.log("[INIT] ✅ Bible Quest initialized");
});

window.addEventListener('load', () => {
    const loader = document.getElementById('loader');
    setTimeout(() => {
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
        }, 500);
    }, 4000); 
});
