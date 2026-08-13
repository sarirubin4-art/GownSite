using System;
using System.Collections.Generic;
using System.Linq;

namespace GownSite.Data
{
    public class OwnerRepository
    {
        private readonly string _connectionString;
        public OwnerRepository(string connectionString)
        {
            _connectionString = connectionString;
        }

        public List<Owner> GetAll()
        {
            using var context = new GownDataContext(_connectionString);
            return context.Owners.OrderBy(o => o.Name).ToList();
        }

        public Owner FindByEmail(string email)
        {
            using var context = new GownDataContext(_connectionString);
            return context.Owners.FirstOrDefault(o => o.Email.ToLower() == email.ToLower());
        }

        public Owner Get(int id)
        {
            using var context = new GownDataContext(_connectionString);
            return context.Owners.FirstOrDefault(o => o.Id == id);
        }

        public int Create(Owner owner)
        {
            using var context = new GownDataContext(_connectionString);
            context.Owners.Add(owner);
            context.SaveChanges();
            return owner.Id;
        }

        public Owner FindByVerificationToken(string token)
        {
            using var context = new GownDataContext(_connectionString);
            return context.Owners.FirstOrDefault(o => o.EmailVerificationToken == token);
        }

        public bool MarkVerified(string token)
        {
            using var context = new GownDataContext(_connectionString);
            var owner = context.Owners.FirstOrDefault(o => o.EmailVerificationToken == token);
            if (owner == null) return false;

            owner.EmailVerified = true;
            owner.EmailVerificationToken = null;
            context.SaveChanges();
            return true;
        }

        public void SetVerificationToken(int id, string token)
        {
            using var context = new GownDataContext(_connectionString);
            var owner = context.Owners.FirstOrDefault(o => o.Id == id);
            if (owner == null) return;

            owner.EmailVerificationToken = token;
            context.SaveChanges();
        }

        public void SetPasswordResetToken(int id, string token, DateTime expiresAt)
        {
            using var context = new GownDataContext(_connectionString);
            var owner = context.Owners.FirstOrDefault(o => o.Id == id);
            if (owner == null) return;

            owner.PasswordResetToken = token;
            owner.PasswordResetTokenExpiresAt = expiresAt;
            context.SaveChanges();
        }

        public Owner FindByValidPasswordResetToken(string token)
        {
            using var context = new GownDataContext(_connectionString);
            return context.Owners.FirstOrDefault(o =>
                o.PasswordResetToken == token &&
                o.PasswordResetTokenExpiresAt != null &&
                o.PasswordResetTokenExpiresAt > DateTime.UtcNow);
        }

        public bool ResetPassword(string token, string newPasswordHash)
        {
            using var context = new GownDataContext(_connectionString);
            var owner = context.Owners.FirstOrDefault(o =>
                o.PasswordResetToken == token &&
                o.PasswordResetTokenExpiresAt != null &&
                o.PasswordResetTokenExpiresAt > DateTime.UtcNow);
            if (owner == null) return false;

            owner.PasswordHash = newPasswordHash;
            owner.PasswordResetToken = null;
            owner.PasswordResetTokenExpiresAt = null;
            context.SaveChanges();
            return true;
        }
    }
}
