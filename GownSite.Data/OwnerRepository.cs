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
    }
}
