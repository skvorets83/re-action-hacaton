namespace GanttManager.Services
{
    public class TaskValidationService
    {
        /// <summary>
        /// Проверяет даты при создании новой задачи
        /// </summary>
        public bool ValidateDates(DateTime startDate, DateTime endDate, out string errorMessage)
        {
            errorMessage = string.Empty;

            // Проверка 1: Дата начала не может быть позже даты окончания
            if (startDate > endDate)
            {
                errorMessage = "Дата начала задачи не может быть позже даты её окончания.";
                return false;
            }

            // Проверка 2: Задача не может длиться 0 дней (или иметь отрицательную длительность)
            if (startDate == endDate)
            {
                errorMessage = "Задача должна длиться как минимум 1 день.";
                return false;
            }

            return true;
        }
    }
}
