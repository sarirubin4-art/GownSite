using System;
using System.Collections.Generic;
using System.Linq;

namespace GownSite.Data
{
    public class PromoCodeRepository
    {
        private readonly string _connectionString;
        public PromoCodeRepository(string connectionString)
        {
            _connectionString = connectionString;
        }

        public PromoCode Create(PromoCode promo)
        {
            using var context = new GownDataContext(_connectionString);
            promo.CreatedDate = DateTime.UtcNow;
            promo.TimesUsed = 0;
            context.PromoCodes.Add(promo);
            context.SaveChanges();
            return promo;
        }

        public PromoCode GetByCode(string code)
        {
            using var context = new GownDataContext(_connectionString);
            return context.PromoCodes.FirstOrDefault(p => p.Code.ToLower() == code.ToLower());
        }

        public List<PromoCode> GetAll()
        {
            using var context = new GownDataContext(_connectionString);
            return context.PromoCodes.OrderByDescending(p => p.CreatedDate).ToList();
        }

        public void Update(PromoCode promo)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.PromoCodes.FirstOrDefault(p => p.Id == promo.Id);
            if (existing == null) return;

            existing.Code = promo.Code;
            existing.DiscountType = promo.DiscountType;
            existing.DiscountValue = promo.DiscountValue;
            existing.MaxUses = promo.MaxUses;
            existing.ExpiresAt = promo.ExpiresAt;
            context.SaveChanges();
        }

        public void IncrementUsage(int id)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.PromoCodes.FirstOrDefault(p => p.Id == id);
            if (existing == null) return;

            existing.TimesUsed++;
            context.SaveChanges();
        }

        public void SetActive(int id, bool isActive)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.PromoCodes.FirstOrDefault(p => p.Id == id);
            if (existing == null) return;

            existing.IsActive = isActive;
            context.SaveChanges();
        }
    }
}
