using System;
using System.Collections.Generic;
using System.Linq;

namespace GownSite.Data
{
    public class SearchAlertRepository
    {
        private readonly string _connectionString;
        public SearchAlertRepository(string connectionString)
        {
            _connectionString = connectionString;
        }

        public SearchAlert Create(SearchAlert alert)
        {
            using var context = new GownDataContext(_connectionString);
            alert.CreatedDate = DateTime.UtcNow;
            alert.IsActive = true;
            alert.UnsubscribeToken = Guid.NewGuid().ToString("N");
            context.SearchAlerts.Add(alert);
            context.SaveChanges();
            return alert;
        }

        public List<SearchAlert> GetAllActive()
        {
            using var context = new GownDataContext(_connectionString);
            return context.SearchAlerts.Where(a => a.IsActive).ToList();
        }

        public bool DeactivateByToken(string token)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.SearchAlerts.FirstOrDefault(a => a.UnsubscribeToken == token);
            if (existing == null) return false;

            existing.IsActive = false;
            context.SaveChanges();
            return true;
        }
    }
}
