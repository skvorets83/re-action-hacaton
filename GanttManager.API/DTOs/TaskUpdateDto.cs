namespace GanttManager.DTOs
{
    public class TaskUpdateDto
    {
        public string Name { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public string Status { get; set; } = "Todo";
        public Guid? AssigneeId { get; set; }
    }
}
