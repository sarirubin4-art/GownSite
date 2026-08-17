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

        public List<ContactMessage> GetAll()
        {
            using var context = new GownDataContext(_connectionString);
            return context.ContactMessages
                .Include(c => c.Owner)
                .OrderByDescending(c => c.CreatedDate)
                .ToList();
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
