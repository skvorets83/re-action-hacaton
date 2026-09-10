namespace GanttManager.DTOs
{
    public class TaskResponseDto
    {
        public Guid Id { get; set; }
        public Guid ProjectId { get; set; }
        public string Name { get; set; } = string.Empty;
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public int DurationInDays { get; set; }
        public string Status { get; set; } = "Todo";
        public Guid? AssigneeId { get; set; }

        public List<Guid> Dependencies { get; set; } = new List<Guid>();
    }
}
