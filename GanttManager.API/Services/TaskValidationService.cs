namespace GanttManager.Services
{
    public class TaskValidationService
    {
        
        
        
        public bool ValidateDates(DateTime startDate, DateTime endDate, out string errorMessage)
        {
            errorMessage = string.Empty;

            
            if (startDate > endDate)
            {
                errorMessage = "Дата начала задачи не может быть позже даты её окончания.";
                return false;
            }

            
            if (startDate == endDate)
            {
                errorMessage = "Задача должна длиться как минимум 1 день.";
                return false;
            }

            return true;
        }
    }
}
