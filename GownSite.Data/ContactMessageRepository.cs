using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.EntityFrameworkCore;

namespace GownSite.Data
{
    public class ContactMessageRepository
    {
        private readonly string _connectionString;
        public ContactMessageRepository(string connectionString)
        {
            _connectionString = connectionString;
        }

        public ContactMessage Create(int ownerId, string topic, string message)
        {
            using var context = new GownDataContext(_connectionString);
            var contactMessage = new ContactMessage
            {
                OwnerId = ownerId,
                Topic = topic,
                Message = message,
                CreatedDate = DateTime.UtcNow,
                IsResolved = false
            };
            context.ContactMessages.Add(contactMessage);
            context.SaveChanges();
            return contactMessage;
        }

        // Unresolved messages need the admin's attention and stay few in practice (she
        // works through them), so they're always loaded in full — no pagination needed.
        public List<ContactMessage> GetOpen()
        {
            using var context = new GownDataContext(_connectionString);
            return context.ContactMessages
                .Include(c => c.Owner)
                .Where(c => !c.IsResolved)
                .OrderByDescending(c => c.CreatedDate)
                .ToList();
        }

        // Resolved messages just accumulate as history, so they're paged instead of
        // fetched in full every time the inbox loads.
        public List<ContactMessage> GetResolvedPage(int page, int pageSize)
        {
            using var context = new GownDataContext(_connectionString);
            return context.ContactMessages
                .Include(c => c.Owner)
                .Where(c => c.IsResolved)
                .OrderByDescending(c => c.ResolvedDate)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToList();
        }

        public int CountResolved()
        {
            using var context = new GownDataContext(_connectionString);
            return context.ContactMessages.Count(c => c.IsResolved);
        }

        public ContactMessage Get(int id)
        {
            using var context = new GownDataContext(_connectionString);
            return context.ContactMessages
                .Include(c => c.Owner)
                .FirstOrDefault(c => c.Id == id);
        }

        public bool Reply(int id, string replyMessage)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.ContactMessages.FirstOrDefault(c => c.Id == id);
            if (existing == null) return false;

            existing.ReplyMessage = replyMessage;
            existing.RepliedDate = DateTime.UtcNow;
            context.SaveChanges();
            return true;
        }

        public bool Resolve(int id)
        {
            using var context = new GownDataContext(_connectionString);
            var existing = context.ContactMessages.FirstOrDefault(c => c.Id == id);
            if (existing == null) return false;

            existing.IsResolved = true;
            existing.ResolvedDate = DateTime.UtcNow;
            context.SaveChanges();
            return true;
        }
    }
}
