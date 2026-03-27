import { isSupabaseConfigured } from '../js/supabase-client.js';
import { signInWithEmail, signUpWithEmail } from '../js/supabase-auth.js';
import { showToast } from '../components/toast.js';

export async function render(container) {
  container.innerHTML = `
    <h1>Sign in</h1>
    <p class="text-light text-sm mb-16">Use your email to keep contacts synced per account.</p>

    <div class="card">
      <div class="form-group">
        <label class="form-label">Email</label>
        <input class="form-input" type="email" id="email" placeholder="you@example.com" autocomplete="email">
      </div>
      <div class="form-group">
        <label class="form-label">Password</label>
        <input class="form-input" type="password" id="password" placeholder="••••••••" autocomplete="current-password">
      </div>
      <button class="btn btn-primary btn-block" id="login-btn">Sign In</button>
      <button class="btn btn-secondary btn-block mt-8" id="signup-btn">Create Account</button>
    </div>

    <p class="text-sm text-light mt-16">${isSupabaseConfigured() ? 'Supabase configured.' : 'Configure Supabase URL and anon key in Settings first.'}</p>
  `;

  const emailInput = container.querySelector('#email');
  const passwordInput = container.querySelector('#password');

  async function handle(action) {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showToast('Email and password are required.', 'warning');
      return;
    }

    try {
      if (action === 'signup') {
        await signUpWithEmail(email, password);
        showToast('Account created. Check your email if confirmation is enabled.', 'success');
      } else {
        await signInWithEmail(email, password);
        showToast('Signed in successfully.', 'success', false);
      }
      location.hash = '#/my-card';
    } catch (error) {
      showToast(error.message || 'Authentication failed.', 'error');
    }
  }

  container.querySelector('#login-btn').addEventListener('click', () => handle('login'));
  container.querySelector('#signup-btn').addEventListener('click', () => handle('signup'));
}
