use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};

use crate::error::{ApiResult, AppError};

/// Encrypts `plaintext` with AES-256-GCM using `key`.
///
/// Returns `(ciphertext, nonce)`. A fresh random nonce is generated per call.
///
/// # Errors
///
/// Returns `AppError::Internal` if cipher initialisation or encryption fails.
pub fn encrypt(key: &[u8; 32], plaintext: &[u8]) -> ApiResult<(Vec<u8>, Vec<u8>)> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("cipher init: {e}")))?;
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("encrypt: {e}")))?;
    Ok((ciphertext, nonce.to_vec()))
}

/// Decrypts `ciphertext` with AES-256-GCM using `key` and `nonce_bytes`.
///
/// # Errors
///
/// Returns `AppError::Internal` if cipher initialisation or decryption fails
/// (e.g. wrong key, wrong nonce, or tampered ciphertext).
pub fn decrypt(key: &[u8; 32], ciphertext: &[u8], nonce_bytes: &[u8]) -> ApiResult<Vec<u8>> {
    let cipher = Aes256Gcm::new_from_slice(key)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("cipher init: {e}")))?;
    let nonce = Nonce::from_slice(nonce_bytes);
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("decrypt: {e}")))?;
    Ok(plaintext)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn zero_key() -> [u8; 32] {
        [0u8; 32]
    }

    #[test]
    fn encrypt_decrypt_round_trip() {
        let key = zero_key();
        let plaintext = b"Hello, Knowledge Assistant!";
        let (ciphertext, nonce) = encrypt(&key, plaintext).expect("encrypt");
        let decrypted = decrypt(&key, &ciphertext, &nonce).expect("decrypt");
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn decrypt_wrong_key_fails() {
        let key_a = zero_key();
        let mut key_b = zero_key();
        key_b[0] = 1;

        let plaintext = b"secret data";
        let (ciphertext, nonce) = encrypt(&key_a, plaintext).expect("encrypt");
        let result = decrypt(&key_b, &ciphertext, &nonce);
        assert!(result.is_err(), "decryption with wrong key must fail");
    }

    #[test]
    fn decrypt_wrong_nonce_fails() {
        let key = zero_key();
        let plaintext = b"secret data";
        let (ciphertext, _nonce) = encrypt(&key, plaintext).expect("encrypt");
        // Use a different nonce (from a second encryption) to ensure determinism.
        let (_, other_nonce) = encrypt(&key, b"other").expect("other encrypt");
        let result = decrypt(&key, &ciphertext, &other_nonce);
        assert!(result.is_err(), "decryption with wrong nonce must fail");
    }

    #[test]
    fn nonces_are_unique_per_call() {
        let key = zero_key();
        let (_, nonce1) = encrypt(&key, b"data").expect("encrypt 1");
        let (_, nonce2) = encrypt(&key, b"data").expect("encrypt 2");
        assert_ne!(
            nonce1, nonce2,
            "each encrypt call must produce a unique nonce"
        );
    }

    #[test]
    fn empty_plaintext_round_trip() {
        let key = zero_key();
        let (ciphertext, nonce) = encrypt(&key, b"").expect("encrypt empty");
        let decrypted = decrypt(&key, &ciphertext, &nonce).expect("decrypt empty");
        assert!(decrypted.is_empty());
    }
}
