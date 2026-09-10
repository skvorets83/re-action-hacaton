namespace GanttManager.DTOs
{
    public class TaskCreateDto
    {
        public Guid ProjectId { get; set; }       // К какому проекту привязана задача
    public string Name { get; set; } = string.Empty; // Название задачи
    public DateTime StartDate { get; set; }    // Дата начала
    public DateTime EndDate { get; set; }      // Дата окончания
    public Guid? AssigneeId { get; set; }
    }
}
