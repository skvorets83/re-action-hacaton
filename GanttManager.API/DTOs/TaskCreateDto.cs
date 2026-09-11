namespace GanttManager.DTOs
{
    public class TaskCreateDto
    {
        public Guid ProjectId { get; set; }     
    public string Name { get; set; } = string.Empty; 
    public DateTime StartDate { get; set; }   
    public DateTime EndDate { get; set; }     
    public Guid? AssigneeId { get; set; }
    }
}
